import {db} from "./db";
import {userKey} from "./crypto";
import type {OrderEvent} from "./order-intake";
import {confirmationMessages,getOrderStockNotice} from './order-stock-notice';
type Confirmation={orderNumber:string;status:string;payment:string|null;issues:unknown;sellerCode?:string|null};
type Sale={status:string;commissionSatang:number|null;recognizedAt?:Date|null};
type Seller={code:string;name:string};
const line=(value:string)=>value.replace(/[\r\n]+/g," ").trim();
export function orderConfirmationText(order:Confirmation,sale?:Sale|null,seller?:Seller|null){
 const sellerInfo=seller?"\nรหัสผู้ขาย: "+line(order.sellerCode??seller.code)+"\nชื่อผู้ขาย: "+line(seller.name)+"\nบันทึกให้ Affiliate: "+line(seller.code):"\nรหัสผู้ขาย: "+line(order.sellerCode??"ยังไม่ระบุ")+"\nยังไม่สามารถระบุบัญชีผู้ขายได้";
 const intro="บันทึกข้อมูลออเดอร์แล้ว\nเลขออเดอร์: "+order.orderNumber+sellerInfo;
 if(order.status==="NEEDS_REVIEW"){
  const issues=Array.isArray(order.issues)?order.issues.map(String):['ข้อมูลไม่ครบ'];
  const phoneWarning=issues.some(issue=>issue.includes('เบอร์โทร'))?'\n⚠️ กรุณาตรวจเบอร์โทรผู้รับให้ถูกต้อง ยกเลิกข้อความออเดอร์เดิมใน LINE แล้วส่งออเดอร์ที่แก้ไขแล้วอีกครั้ง':'';
  return intro+phoneWarning+"\nต้องตรวจข้อมูลเพิ่มเติม: "+issues.join(" · ")+"\nยังไม่บันทึกยอดขายหรือค่าคอม";
 }
 if(order.payment==="เคลม")return intro+"\nรายการเคลม · รอต้นทุนสินค้าจากสต็อก\nไม่รวมค่าส่งในต้นทุนเคลม\nไม่เพิ่มยอดขายหรือค่าคอม";
 if(order.payment==="โอน"){
  const transferIntro=intro+(sale?.recognizedAt?"\nยืนยันยอดขายจากรายการจัดส่งแล้ว":"\nยอดขายรอยืนยันจัดส่งจริง");
  if(sale?.status==="WAITING_COST")return transferIntro+"\nบันทึกยอดโอนแล้ว\nค่าคอมรอต้นทุนสินค้า";
  if(sale?.status==="PENDING"&&sale.commissionSatang!==null)return transferIntro+"\nบันทึกค่าคอมสำเร็จ ฿"+(sale.commissionSatang/100).toFixed(2)+" (ยอดรอจ่าย)\nคิดตามยอดโอนที่แจ้ง ไม่มีการตรวจสลิปอัตโนมัติ";
  return transferIntro+"\nยังไม่บันทึกค่าคอม กรุณาตรวจยอดและรหัสผู้ขาย";
 }
 return intro+"\nCOD: รอจับคู่พัสดุกับรายงานรับเงิน COD\nยังไม่บันทึกยอดขายหรือค่าคอม";
}
export async function replyOrderConfirmation(botId:string,event:OrderEvent,accessToken?:string){
 if(event.type!=="message"||event.message?.type!=="text"||event.source.type!=="group"||!event.replyToken)return;
 const messageKey=userKey("order-message:"+botId+":"+event.message.id);
 const order=await db.orderIntake.findUnique({where:{messageKey}});
 if(!order||["WITHDRAWN","EXPIRED","CANCELLED","RETURNED"].includes(order.status)||["SENT","SENDING"].includes(order.replyStatus))return;
 if(!accessToken){await db.orderIntake.updateMany({where:{id:order.id,replyStatus:{not:"SENT"}},data:{replyStatus:"NOT_CONFIGURED",replyLastError:"ACCESS_TOKEN_MISSING"}});return;}
 const claimed=await db.orderIntake.updateMany({where:{id:order.id,status:{notIn:["WITHDRAWN","EXPIRED","CANCELLED","RETURNED"]},replyStatus:{in:["NOT_SENT","FAILED","NOT_CONFIGURED"]},replyAttempts:{lt:2}},data:{replyStatus:"SENDING",replyAttempts:{increment:1},replyLastError:null}});
 if(!claimed.count)return;
 try{
  const sale=order.payment==="โอน"?await db.salesOrder.findUnique({where:{orderId:order.id},select:{status:true,commissionSatang:true,recognizedAt:true}}):null;
  const seller=order.affiliateId?await db.affiliate.findUnique({where:{id:order.affiliateId},select:{code:true,name:true}}):null;
  const notice=await getOrderStockNotice(order.id);
  const current=await db.orderIntake.findUnique({where:{id:order.id},select:{status:true}});
  if(!current||['WITHDRAWN','EXPIRED','CANCELLED','RETURNED'].includes(current.status))return;
  const response=await fetch("https://api.line.me/v2/bot/message/reply",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({replyToken:event.replyToken,messages:confirmationMessages(orderConfirmationText(order,sale,seller),notice)}),cache:"no-store",signal:AbortSignal.timeout(8000)});
  await db.orderIntake.update({where:{id:order.id},data:response.ok?{replyStatus:"SENT",repliedAt:new Date(),replyLastError:null}:{replyStatus:"FAILED",replyLastError:"LINE_HTTP_"+response.status}});
 }catch{await db.orderIntake.update({where:{id:order.id},data:{replyStatus:"FAILED",replyLastError:"DELIVERY_UNCONFIRMED"}});}
}
