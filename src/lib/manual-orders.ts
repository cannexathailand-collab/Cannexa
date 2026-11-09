import {z} from 'zod';
import {transaction,userLock} from './db';
import {sha,userKey} from './crypto';
import {admitOrderText} from './order-intake';
import {orderRejectionReasons} from './order-validation';
import {parseOrderText} from './order-parser';
import {stockCode} from './stock-code';
import type {StockReader} from './order-stock-admission';
import {parseRewardImage} from './crm-reward-image';

const line=z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/);
const inputSchema=z.object({
 requestKey:z.uuid(),groupId:line,sellerCode:z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9._-]+$/),customerCode:line,recipient:line,phone:line,
 address:z.string().trim().min(1).max(2000),payment:z.enum(['COD','โอน']),
 amountSatang:z.number().int().positive().max(2147483647),
 items:z.array(z.object({code:stockCode,grams:z.number().positive().max(999999).multipleOf(0.001)})).min(1).max(50),
 slip:z.string().optional(),
});
export type ManualOrderInput=z.infer<typeof inputSchema>;
type ManualOrderResult={reasons:string[]}|{orderId:string;orderNumber:string;status:string};
export function manualOrderText(input:ManualOrderInput){
 return [
  'รหัสผู้ขาย: '+input.sellerCode,'รหัสลูกค้า: '+input.customerCode,'ผู้รับ: '+input.recipient,
  'โทร: '+input.phone,'ที่อยู่: '+input.address.replace(/[\r\n]+/g,' '),
  'สินค้า',...input.items.map(item=>item.code+' x '+item.grams+' G'),
  'ชำระเงิน: '+input.payment,'ยอดรวม: '+(input.amountSatang/100).toFixed(2),
 ].join('\n');
}
export async function createManualOrder(actor:string,value:unknown,stockReader?:StockReader):Promise<ManualOrderResult>{
 const parsed=inputSchema.safeParse(value);
 if(!parsed.success)throw Error('กรุณากรอกทีม ลูกค้า สินค้า และยอดเงินให้ครบถ้วน');
 const input=parsed.data,text=manualOrderText(input),fingerprint=sha(JSON.stringify(input));
 const messageKey=userKey('manual-order:'+input.requestKey),auditId='manual-order:'+input.requestKey;
 return transaction(async tx=>{
  await userLock(tx,messageKey);
  const previous=await tx.auditLog.findUnique({where:{id:auditId}});
  if(previous){
   const details=previous.details as {fingerprint?:string;reasons?:string[]};
   if(details.fingerprint!==fingerprint)throw Error('คำขอเดิมมีข้อมูลเปลี่ยนแปลง กรุณาส่งใหม่');
   if(previous.action==='ORDER_REJECTED')return {reasons:details.reasons??['บันทึกไม่สำเร็จ']};
   const order=await tx.orderIntake.findUniqueOrThrow({where:{id:previous.entityId}});
   return {orderId:order.id,orderNumber:order.orderNumber,status:order.status};
  }
  let slip:ReturnType<typeof parseRewardImage>|null=null;
  if(input.payment==='โอน'){
   if(!input.slip)throw Error('กรุณาแนบรูปหลักฐานการโอนเงิน');
   try{slip=parseRewardImage(input.slip);}catch{throw Error('รูปสลิปต้องเป็น JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB');}
  }else if(input.slip)throw Error('แนบสลิปได้เฉพาะออเดอร์โอนเงิน');
  const group=await tx.orderGroup.findUnique({where:{id:input.groupId}});
  if(!group?.enabled||group.purpose!=='ORDER')throw Error('กรุณาเลือกทีมที่เปิดรับออเดอร์');
  const orderData=parseOrderText(text)!;
  const reasons=orderRejectionReasons(orderData);
  const eventAt=new Date();
  const result=reasons.length?{reasons}:await admitOrderText(tx,{text,eventKey:messageKey,messageKey,groupKey:group.id,senderKey:null,eventAt,actor},stockReader);
  if('reasons' in result){
   await tx.auditLog.create({data:{id:auditId,actor,action:'ORDER_REJECTED',entityId:messageKey,details:{fingerprint,status:'SHOWN_IN_WEB',reasons:result.reasons,phone:orderData.phone,amountSatang:input.amountSatang,eventAt:eventAt.toISOString(),groupKey:group.id,source:'MANUAL'}}});
   return {reasons:result.reasons};
  }
  if(slip)await tx.orderPaymentSlip.create({data:{orderId:result.order.id,data:slip.imageData,mime:slip.imageMime,version:slip.imageVersion}});
  await tx.auditLog.create({data:{id:auditId,actor,action:'ORDER_MANUAL_CREATED',entityId:result.order.id,details:{fingerprint,orderNumber:result.order.orderNumber,groupKey:group.id,team:group.name}}});
  return {orderId:result.order.id,orderNumber:result.order.orderNumber,status:result.order.status};
 },55000);
}
