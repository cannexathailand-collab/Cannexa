import {db,transaction,userLock} from './db';
import {displayCustomerCode} from './customer-code';
export async function syncLoginCustomer(key:string,conversion:{id:string;customerCode:string;affiliateId:string},metaFbc:string|null){
 return transaction(async tx=>{
  await userLock(tx,key);
  const row=await tx.customer.upsert({where:{code:conversion.customerCode},create:{code:conversion.customerCode,lineUserKey:key,conversionId:conversion.id,referrerId:conversion.affiliateId,metaFbc},update:{lineUserKey:key,conversionId:conversion.id}});
  return !row.referrerId?tx.customer.update({where:{code:row.code},data:{referrerId:conversion.affiliateId,metaFbc:row.metaFbc??metaFbc}}):row;
 });
}
export function customerCodeMessage(code:string){return `รหัสลูกค้าของคุณ: ${displayCustomerCode(code)}\nแจ้งรหัสนี้กับพนักงานเมื่อสั่งซื้อ\nใช้รหัสเดิมได้ทุกครั้ง`;}
export async function replyCustomerCode(input:{key:string;eventId:string;replyToken?:string;unblocked:boolean|null;accessToken?:string;requested?:boolean}){
 if(input.unblocked===true||!input.replyToken||!input.accessToken)return;
 const deliveryKey=input.requested?'request:'+input.eventId:input.key;
 const prepared=await transaction(async tx=>{
  await userLock(tx,input.key);
  if(await tx.customerCodeDelivery.findUnique({where:{userKey:deliveryKey}}))return null;
  const conversion=await tx.conversion.findUnique({where:{userKey:input.key}});
  if(conversion&&conversion.source!=='LINE')return null;
  let customer;
  if(conversion){
   const click=await tx.click.findUniqueOrThrow({where:{id:conversion.clickId}});
   customer=await tx.customer.upsert({where:{code:conversion.customerCode},create:{code:conversion.customerCode,lineUserKey:input.key,conversionId:conversion.id,referrerId:conversion.affiliateId,metaFbc:click.metaFbc},update:{lineUserKey:input.key,conversionId:conversion.id}});
  }else customer=await tx.customer.upsert({where:{lineUserKey:input.key},create:{lineUserKey:input.key},update:{}});
  await tx.customerCodeDelivery.create({data:{userKey:deliveryKey,eventId:input.eventId,customerCode:customer.code}});
  return customer.code;
 });
 if(!prepared)return;
 try{
  const response=await fetch('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{Authorization:'Bearer '+input.accessToken,'Content-Type':'application/json'},body:JSON.stringify({replyToken:input.replyToken,messages:[{type:'text',text:customerCodeMessage(prepared)}]}),signal:AbortSignal.timeout(8000),cache:'no-store'});
  await db.customerCodeDelivery.update({where:{userKey:deliveryKey},data:response.ok?{status:'SENT',sentAt:new Date()}:{status:'FAILED',lastError:'LINE_HTTP_'+response.status}});
 }catch{await db.customerCodeDelivery.update({where:{userKey:deliveryKey},data:{status:'FAILED',lastError:'DELIVERY_UNCONFIRMED'}});}
}
