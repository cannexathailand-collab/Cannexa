import {db} from './db';
import {metaSettings} from './meta';
import {sha} from './crypto';
import {salesReport} from './sales-report';
import {bangkokDay,shiftDay} from './sales-dates';
export function metaPurchasePayload(orderId:string,at:Date,amountSatang:number,fbc:string|null,identity:string){
 if(!Number.isSafeInteger(amountSatang)||amountSatang<=0||!Number.isFinite(+at)||fbc!==null&&!/^fb\.1\.\d+\.[A-Za-z0-9_-]+$/.test(fbc))throw Error('INVALID_META_PURCHASE');
 return {event_name:'Purchase',event_id:'purchase-'+sha(orderId),event_time:Math.floor(+at/1000),action_source:'chat',user_data:{...(fbc?{fbc}:{}),external_id:sha(identity)},custom_data:{currency:'THB',value:amountSatang/100}};
}
export async function processMetaPurchases(){
 const settings=metaSettings();if(!settings)return {sent:0};
 if(!process.env.META_TEST_EVENT_CODE&&process.env.META_PURCHASE_ENABLED!=='true')return {sent:0};
 const connection=await db.metaConnection.findUnique({where:{id:'default'}});if(!connection)return {sent:0};
 const today=bangkokDay(new Date()),report=await salesReport({from:shiftDay(today,-30),to:today});
 for(const sale of report.summary.rows){
  const order=await db.orderIntake.findUnique({where:{id:sale.orderId}});if(!order?.customerCode)continue;
  const customer=await db.customer.findUnique({where:{code:order.customerCode},include:{referrer:{select:{code:true}}}});if(!customer||(!customer.metaFbc&&customer.referrer?.code!=='meta-ad'))continue;
  const separator=customer.metaFbc?.indexOf(':')??-1,dataset=customer.metaFbc?.slice(0,separator),fbc=customer.metaFbc?.slice(separator+1)??null;if(dataset&&dataset!==connection.datasetId)continue;
  const at=sale.paymentMethod==='COD'&&sale.receipt?sale.receipt.reportAt:sale.recognizedAt!;
  const payload=metaPurchasePayload(sale.orderId,at,sale.revenueSatang,fbc,customer.code);
  await db.metaPurchase.upsert({where:{orderId:sale.orderId},create:{orderId:sale.orderId,eventId:payload.event_id,payload:{event:payload,datasetId:connection.datasetId}},update:{}});
 }
 let sent=0;
 const pending=await db.metaPurchase.findMany({where:{status:{in:['PENDING','RETRY']},attempts:{lt:3}},orderBy:{createdAt:'asc'},take:20});
 for(const entry of pending){
  const sale=report.summary.rows.find(s=>s.orderId===entry.orderId);if(!sale){await db.metaPurchase.update({where:{orderId:entry.orderId},data:{status:'CANCELLED',lastError:'SALE_NOT_RECOGNIZED'}});continue;}
  const saved=entry.payload as unknown as {event:ReturnType<typeof metaPurchasePayload>;datasetId:string};
  if(saved.datasetId!==connection.datasetId){await db.metaPurchase.update({where:{orderId:entry.orderId},data:{status:'NEEDS_REVIEW',lastError:'DATASET_CHANGED'}});continue;}
  const payload=saved.event;
  if(Date.now()/1000-payload.event_time>7*86400||entry.attempts>0&&Date.now()-+entry.createdAt>24*3600000){await db.metaPurchase.update({where:{orderId:entry.orderId},data:{status:'NEEDS_REVIEW',lastError:'EVENT_TOO_OLD'}});continue;}
  const claimed=await db.metaPurchase.updateMany({where:{orderId:entry.orderId,status:entry.status,attempts:entry.attempts},data:{status:'SENDING',attempts:{increment:1}}});if(!claimed.count)continue;
  try{
   const response=await fetch(`https://graph.facebook.com/${settings.version}/${connection.datasetId}/events`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+settings.token},body:JSON.stringify({data:[payload],...(process.env.META_TEST_EVENT_CODE?{test_event_code:process.env.META_TEST_EVENT_CODE}:{})}),signal:AbortSignal.timeout(8000)});
   const result=await response.json().catch(()=>null),ok=response.ok&&result?.events_received===1;
   await db.metaPurchase.update({where:{orderId:entry.orderId},data:ok?{status:'SENT',sentAt:new Date(),lastError:null}:{status:'RETRY',lastError:'META_HTTP_'+response.status}});if(ok)sent++;
  }catch{await db.metaPurchase.update({where:{orderId:entry.orderId},data:{status:'RETRY',lastError:'DELIVERY_UNCONFIRMED'}});}
 }
 return {sent};
}
