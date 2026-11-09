import {db,transaction,userLock} from './db';
import {userKey} from './crypto';
import {parseOrderText} from './order-parser';
import type {OrderEvent} from './order-intake';
import {orderRejectionReasons,orderRejectionText} from './order-validation';
import {quotedTotal} from './shipment-matching';

export async function replyRejectedOrder(botId:string,event:OrderEvent,accessToken?:string){
 if(!accessToken||event.type!=='message'||event.message?.type!=='text'||!event.message.text||event.source.type!=='group'||!event.source.groupId||!event.replyToken)return;
 const parsed=parseOrderText(event.message.text);if(!parsed)return;
 const context={phone:parsed.phone,amountSatang:quotedTotal(event.message.text),eventAt:new Date(event.timestamp).toISOString()};
 let reasons=orderRejectionReasons(parsed);
 const groupKey=userKey('order-group:'+botId+':'+event.source.groupId);
 const group=await db.orderGroup.findUnique({where:{id:groupKey}});
 if(!group?.enabled||(group.purpose&&group.purpose!=='ORDER'))return;
 const messageKey=userKey('order-message:'+botId+':'+event.message.id),id=userKey('order-rejection:'+botId+':'+event.message.id);
 const claimed=await transaction(async tx=>{
  await userLock(tx,messageKey);
  if(await tx.orderMessageWithdrawal.findUnique({where:{messageKey}})||await tx.orderIntake.findFirst({where:{messageKey}}))return false;
  const previous=await tx.auditLog.findUnique({where:{id}});
  if(previous){
   const detail=previous.details as {status?:string;reasons?:unknown};
   if(detail?.status!=='READY'||!Array.isArray(detail.reasons))return false;
   reasons=detail.reasons.filter((reason):reason is string=>typeof reason==='string');
   if(!reasons.length)return false;
   await tx.auditLog.update({where:{id},data:{details:{...context,status:'SENDING',reasons}}});
  }else{
   if(!reasons.length)return false;
   await tx.auditLog.create({data:{id,actor:'line-order',action:'ORDER_REJECTED',entityId:messageKey,details:{...context,status:'SENDING',reasons}}});
  }
  return true;
 });
 if(!claimed)return;
 try{
  const response=await fetch('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({replyToken:event.replyToken,messages:[{type:'text',text:orderRejectionText(reasons)}]}),signal:AbortSignal.timeout(8000),cache:'no-store'});
  await db.auditLog.update({where:{id},data:{details:{...context,status:response.ok?'SENT':'FAILED',reasons}}});
 }catch{await db.auditLog.update({where:{id},data:{details:{...context,status:'DELIVERY_UNCONFIRMED',reasons}}});}
}
