import {randomBytes} from "node:crypto";
import {db,transaction,userLock} from "./db";
import {userKey} from "./crypto";
import {parseOrderText} from "./order-parser";
import {metaAdCode} from "./meta-ad";
import {quotedTotal} from "./shipment-matching";
import {reverseOrderSales} from "./sales-cancellation";
import {salesCommissionRate} from './sales-commission-rate';
import {resolveOrderCustomer} from './order-customer';

export type OrderEvent={webhookEventId:string;type:string;timestamp:number;replyToken?:string;source:{type?:string;groupId?:string;userId?:string};message?:{type:string;id:string;text?:string};unsend?:{messageId:string}};
export async function receiveOrderEvent(botId:string,e:OrderEvent){
 if(e.source.type!=="group"||!e.source.groupId)return null;
 const groupKey=userKey("order-group:"+botId+":"+e.source.groupId);
 const group=await db.orderGroup.upsert({where:{id:groupKey},create:{id:groupKey,botId,groupId:e.source.groupId},update:{lastSeenAt:new Date()}});
 if(group.purpose&&group.purpose!=="ORDER")return null;
 if(e.type==="unsend"&&e.unsend){
  const messageKey=userKey("order-message:"+botId+":"+e.unsend.messageId);
  await transaction(async tx=>{
   await userLock(tx,messageKey);
   await tx.orderMessageWithdrawal.upsert({where:{messageKey},create:{messageKey},update:{}});
   const orders=await tx.orderIntake.findMany({where:{messageKey,groupKey},select:{id:true}});
   if(orders.length)await reverseOrderSales(tx,orders.map(o=>o.id));
   if(orders.length){
    await tx.shipment.updateMany({where:{orderId:{in:orders.map(o=>o.id)},status:{not:"RETURNED"}},data:{status:"CANCELLED",fulfillmentStatus:"CANCELLED"}});
    await tx.orderIntake.deleteMany({where:{messageKey,groupKey}});
    for(const order of orders)await tx.auditLog.create({data:{actor:"line-unsend",action:"CANCELLED_ORDER_REMOVED",entityId:order.id,details:{}}});
   }
  });return null;
 }
 if(!group.enabled||e.type!=="message"||e.message?.type!=="text"||!e.message.text)return null;
 const parsed=parseOrderText(e.message.text);if(!parsed)return null;
 const messageKey=userKey("order-message:"+botId+":"+e.message.id);
 const eventKey=userKey("order-event:"+botId+":"+e.webhookEventId);
 return transaction(async tx=>{
  await userLock(tx,messageKey);
  if(await tx.orderMessageWithdrawal.findUnique({where:{messageKey}}))return null;
  const previous=await tx.orderIntake.findFirst({where:{OR:[{messageKey},{eventKey}]}});if(previous)return null;
  // Recheck inside the write transaction so disabling a group takes effect before save.
  const currentGroup=await tx.orderGroup.findUnique({where:{id:groupKey}});if(!currentGroup?.enabled||(currentGroup.purpose&&currentGroup.purpose!=="ORDER"))return null;
  const sellers=await tx.affiliate.findMany({where:{archivedAt:null,active:true,code:{not:metaAdCode},OR:[{code:{equals:parsed.sellerCode,mode:"insensitive"}},{accounts:{some:{username:{equals:parsed.sellerCode,mode:"insensitive"},role:"employee",active:true}}}]},select:{id:true,salesCommissionBasis:true,salesCommissionBps:true,salesCommissionTransferBps:true,salesCommissionCodBps:true,accounts:{where:{role:"employee",active:true},select:{username:true}}},take:2});
  const issues=[...parsed.issues];if(sellers.length!==1)issues.push("ไม่พบรหัสผู้ขายที่ใช้งานอยู่เพียงรายเดียว");
  let customer=null;
  if(sellers.length===1&&parsed.recipient&&parsed.phone){try{customer=await resolveOrderCustomer(tx,{code:parsed.customerCode,name:parsed.recipient,phone:parsed.phone,sellerId:sellers[0].id});}catch(e){if(e instanceof Error&&e.message==='CUSTOMER_IDENTITY_CONFLICT')issues.push('รหัสลูกค้ากับชื่อหรือเบอร์โทรไม่ตรงกัน กรุณาตรวจสอบ');else throw e;}}
  if(parsed.customerCode&&!customer)issues.push('ไม่พบรหัสลูกค้า กรุณาตรวจรหัสกับลูกค้าอีกครั้ง');
  const owner=customer?.referrerId&&customer.referrerId!==sellers[0]?.id?await tx.affiliate.findUnique({where:{id:customer.referrerId}}):sellers[0];
  if(!owner)issues.push('ไม่พบผู้แนะนำของลูกค้า');
  if(owner&&('active' in owner&&!owner.active||'archivedAt' in owner&&owner.archivedAt))issues.push('บัญชีผู้แนะนำถูกระงับ กรุณาตรวจสอบก่อนคิดค่าคอม');
  const total=quotedTotal(e.message!.text!);if(parsed.payment==="โอน"&&(total===null||total<=0))issues.push("ยอดโอนต้องระบุยอดรวมที่มากกว่าศูนย์เพียงยอดเดียว");
  const transfer=parsed.payment==="โอน"&&!issues.length;
  const accounts=sellers.length===1?(sellers[0].accounts??[]):[];
  const exact=accounts.filter(a=>a.username.toLowerCase()===parsed.sellerCode.toLowerCase());
  const sellerUsername=exact.length===1?exact[0].username:exact.length===0&&accounts.length===1?accounts[0].username:null;
  const commissionBps=owner?('code' in owner&&owner.code===metaAdCode?0:salesCommissionRate(owner,parsed.payment)):null;
  const order=await tx.orderIntake.create({data:{eventKey,messageKey,groupKey,senderKey:e.source.userId?userKey("order-sender:"+botId+":"+e.source.userId):null,orderNumber:"ORD-"+randomBytes(10).toString("hex").toUpperCase(),rawText:e.message!.text!,sellerCode:parsed.sellerCode,sellerUsername,customerCode:customer?.code??null,affiliateId:sellers.length===1?sellers[0].id:null,commissionAffiliateId:owner?.id??null,salesCommissionBasis:owner?.salesCommissionBasis??null,salesCommissionBps:commissionBps,recipient:parsed.recipient,phone:parsed.phone,address:parsed.address,payment:parsed.payment,issues,status:issues.length?"NEEDS_REVIEW":transfer?"TRANSFER_RECORDED":parsed.payment==="เคลม"?"CLAIM_WAITING_COST":"WAITING_SHIPMENT",eventAt:new Date(e.timestamp)}});
  if(transfer&&owner){const profit=owner.salesCommissionBasis==="PROFIT";await tx.salesOrder.create({data:{orderId:order.id,tracking:null,affiliateId:owner.id,paymentMethod:"TRANSFER",paymentEvidence:"DECLARED_TRANSFER",revenueSatang:total!,commissionBasis:owner.salesCommissionBasis,commissionBps:commissionBps!,commissionSatang:profit?null:Math.round(total!*commissionBps!/10000),status:profit?"WAITING_COST":"PENDING"}});await tx.auditLog.create({data:{actor:"line-order",action:"TRANSFER_SALE_RECORDED",entityId:order.id,details:{evidence:"DECLARED_TRANSFER"}}});}
  if(customer&&owner&&sellers.length===1&&owner.id!==sellers[0].id&&parsed.payment!=='เคลม'&&!issues.length){await tx.additionalCommission.create({data:{orderId:order.id,affiliateId:sellers[0].id,basis:sellers[0].salesCommissionBasis,bps:salesCommissionRate(sellers[0],parsed.payment)}});}
  return order;
 });
}
