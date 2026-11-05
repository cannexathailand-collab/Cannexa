import {db} from "./db";
import {userKey} from "./crypto";
import type {OrderEvent} from "./order-intake";
type Confirmation={orderNumber:string;status:string;payment:string|null;issues:unknown};
export function orderConfirmationText(order:Confirmation){
 const intro="บันทึกข้อมูลออเดอร์แล้ว\nเลขออเดอร์: "+order.orderNumber;
 if(order.status==="NEEDS_REVIEW")return intro+"\nต้องตรวจข้อมูลเพิ่มเติม: "+(Array.isArray(order.issues)?order.issues.map(String).join(" · "):"ข้อมูลไม่ครบ")+"\nยังไม่บันทึกยอดขายหรือค่าคอม";
 if(order.payment==="โอน")return intro+"\nยอดโอน: รอตรวจสลิปจริง\nยังไม่บันทึกค่าคอม จนกว่าจะยืนยันสลิปผ่าน";
 return intro+"\nCOD: รอจับคู่รายงานจัดส่งจริง\nยังไม่บันทึกยอดขายหรือค่าคอม";
}
export async function replyOrderConfirmation(botId:string,event:OrderEvent,accessToken?:string){
 if(event.type!=="message"||event.message?.type!=="text"||event.source.type!=="group"||!event.replyToken)return;
 const messageKey=userKey("order-message:"+botId+":"+event.message.id);
 const order=await db.orderIntake.findUnique({where:{messageKey}});
 if(!order||["WITHDRAWN","EXPIRED"].includes(order.status)||["SENT","SENDING"].includes(order.replyStatus))return;
 if(!accessToken){await db.orderIntake.updateMany({where:{id:order.id,replyStatus:{not:"SENT"}},data:{replyStatus:"NOT_CONFIGURED",replyLastError:"ACCESS_TOKEN_MISSING"}});return;}
 const claimed=await db.orderIntake.updateMany({where:{id:order.id,status:{notIn:["WITHDRAWN","EXPIRED"]},replyStatus:{in:["NOT_SENT","FAILED","NOT_CONFIGURED"]},replyAttempts:{lt:2}},data:{replyStatus:"SENDING",replyAttempts:{increment:1},replyLastError:null}});
 if(!claimed.count)return;
 try{
  const response=await fetch("https://api.line.me/v2/bot/message/reply",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({replyToken:event.replyToken,messages:[{type:"text",text:orderConfirmationText(order)}]}),cache:"no-store",signal:AbortSignal.timeout(8000)});
  await db.orderIntake.update({where:{id:order.id},data:response.ok?{replyStatus:"SENT",repliedAt:new Date(),replyLastError:null}:{replyStatus:"FAILED",replyLastError:"LINE_HTTP_"+response.status}});
 }catch{await db.orderIntake.update({where:{id:order.id},data:{replyStatus:"FAILED",replyLastError:"DELIVERY_UNCONFIRMED"}});}
}
