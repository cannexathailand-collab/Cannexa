import {db,transaction,userLock} from './db';
import {userKey} from './crypto';
import {parseOrderText} from './order-parser';
import type {OrderEvent} from './order-intake';
import {orderRejectionReasons,orderRejectionText} from './order-validation';

export async function replyRejectedOrder(botId:string,event:OrderEvent,accessToken?:string){
 if(!accessToken||event.type!=='message'||event.message?.type!=='text'||!event.message.text||event.source.type!=='group'||!event.source.groupId||!event.replyToken)return;
 const parsed=parseOrderText(event.message.text);if(!parsed)return;
 const reasons=orderRejectionReasons(parsed);if(!reasons.length)return;
 const groupKey=userKey('order-group:'+botId+':'+event.source.groupId);
 const group=await db.orderGroup.findUnique({where:{id:groupKey}});
 if(!group?.enabled||(group.purpose&&group.purpose!=='ORDER'))return;
 const messageKey=userKey('order-message:'+botId+':'+event.message.id),id=userKey('order-rejection:'+botId+':'+event.message.id);
 const claimed=await transaction(async tx=>{
  await userLock(tx,messageKey);
  if(await tx.orderMessageWithdrawal.findUnique({where:{messageKey}})||await tx.orderIntake.findFirst({where:{messageKey}})||await tx.auditLog.findUnique({where:{id}}))return false;
  await tx.auditLog.create({data:{id,actor:'line-order',action:'ORDER_REJECTED',entityId:messageKey,details:{status:'SENDING',reasons}}});return true;
 });
 if(!claimed)return;
 try{
  const response=await fetch('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({replyToken:event.replyToken,messages:[{type:'text',text:orderRejectionText(reasons)}]}),signal:AbortSignal.timeout(8000),cache:'no-store'});
  await db.auditLog.update({where:{id},data:{details:{status:response.ok?'SENT':'FAILED',reasons}}});
 }catch{await db.auditLog.update({where:{id},data:{details:{status:'DELIVERY_UNCONFIRMED',reasons}}});}
}
