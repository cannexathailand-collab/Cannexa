import {db} from "./db";
import {displayCustomerCode} from './customer-code';
import {userKey} from "./crypto";
import type {OrderEvent} from "./order-intake";
import {confirmationMessages,getOrderStockNotice} from './order-stock-notice';
import {loadOrderReplyContext,type OrderReplyContext} from './order-reply-context';
type Confirmation={orderNumber:string;status:string;payment:string|null;issues:unknown;sellerCode?:string|null;customerCode?:string|null};
type Sale={status:string;commissionSatang:number|null;recognizedAt?:Date|null};
type Seller={code:string;name:string};
const line=(value:string)=>value.replace(/[\r\n]+/g," ").trim();
export function orderConfirmationText(order:Confirmation,sale?:Sale|null,seller?:Seller|null,context?:OrderReplyContext){
 const amount=context?context.pendingSatang:(sale?.status==='PENDING'?sale.commissionSatang:null);
 const currentReady=!!sale&&['PENDING','PAID'].includes(sale.status)&&sale.commissionSatang!==null&&(order.payment!=='COD'||!!sale.recognizedAt);
 let commission=amount===null?'รอคำนวณ':(amount/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท';
 if(context&&amount!==null&&!currentReady&&order.payment!=='เคลม')commission+=' · รายการนี้รอคำนวณ';
 const text=[
  'บันทึกออเดอร์แล้ว',
  'ผู้ขาย: '+line(seller?.name??order.sellerCode??'ยังไม่ระบุ')+' | ค่าคอมรอรับสะสม: '+commission,
  'ลูกค้า: '+(order.customerCode?line(displayCustomerCode(order.customerCode)):'ยังไม่ระบุ')+' | Member: '+line(context?.membership??'ยังไม่ระบุ'),
  'Green Coin: '+(context?.points===null||context?.points===undefined?'รอข้อมูล':context.points.toLocaleString('th-TH')+' Green Coin')
 ].join('\n');
 if(order.status==='NEEDS_REVIEW'){
  const issues=Array.isArray(order.issues)?order.issues.map(String):['ข้อมูลไม่ครบ'];
  const correction=issues.some(issue=>issue.includes('เบอร์โทร'))?' กรุณาตรวจเบอร์โทรผู้รับ ยกเลิกข้อความออเดอร์เดิมแล้วส่งข้อความที่แก้ไขใหม่':'';
  return text+'\nต้องตรวจสอบ: '+issues.join(' · ')+correction;
 }
 return order.payment==='เคลม'?text+'\nรายการเคลม ไม่เพิ่มยอดขายหรือค่าคอม':text;
}
export async function replyOrderConfirmation(botId:string,event:OrderEvent,accessToken?:string,readContext=loadOrderReplyContext){
 if(event.type!=="message"||event.message?.type!=="text"||event.source.type!=="group"||!event.replyToken)return;
 const messageKey=userKey("order-message:"+botId+":"+event.message.id);
 const order=await db.orderIntake.findUnique({where:{messageKey}});
 if(!order||["WITHDRAWN","EXPIRED","CANCELLED","RETURNED"].includes(order.status)||["SENT","SENDING"].includes(order.replyStatus))return;
 if(!accessToken){await db.orderIntake.updateMany({where:{id:order.id,replyStatus:{not:"SENT"}},data:{replyStatus:"NOT_CONFIGURED",replyLastError:"ACCESS_TOKEN_MISSING"}});return;}
 const claimed=await db.orderIntake.updateMany({where:{id:order.id,status:{notIn:["WITHDRAWN","EXPIRED","CANCELLED","RETURNED"]},replyStatus:{in:["NOT_SENT","FAILED","NOT_CONFIGURED"]},replyAttempts:{lt:2}},data:{replyStatus:"SENDING",replyAttempts:{increment:1},replyLastError:null}});
 if(!claimed.count)return;
 try{
  const primary=await db.salesOrder.findUnique({where:{orderId:order.id}});
  const extra=order.affiliateId&&primary?.affiliateId!==order.affiliateId?await db.additionalCommission.findUnique({where:{orderId_affiliateId:{orderId:order.id,affiliateId:order.affiliateId}}}):null;
  const sale=extra?{status:extra.status,commissionSatang:extra.amountSatang,recognizedAt:primary?.recognizedAt}:primary?.affiliateId===order.affiliateId?primary:null;
  const seller=order.affiliateId?await db.affiliate.findUnique({where:{id:order.affiliateId},select:{code:true,name:true}}):null;
  const [notice,context]=await Promise.all([getOrderStockNotice(order.id),readContext(order).catch(()=>({pendingSatang:null,membership:null,points:null}))]);
  const current=await db.orderIntake.findUnique({where:{id:order.id},select:{status:true}});
  if(!current||['WITHDRAWN','EXPIRED','CANCELLED','RETURNED'].includes(current.status))return;
  const response=await fetch("https://api.line.me/v2/bot/message/reply",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({replyToken:event.replyToken,messages:confirmationMessages(orderConfirmationText(order,sale,seller,context),notice)}),cache:"no-store",signal:AbortSignal.timeout(8000)});
  await db.orderIntake.update({where:{id:order.id},data:response.ok?{replyStatus:"SENT",repliedAt:new Date(),replyLastError:null}:{replyStatus:"FAILED",replyLastError:"LINE_HTTP_"+response.status}});
 }catch{await db.orderIntake.update({where:{id:order.id},data:{replyStatus:"FAILED",replyLastError:"DELIVERY_UNCONFIRMED"}});}
}
