import {randomBytes,randomUUID} from 'node:crypto';
import {db,transaction,userLock} from './db';
import {sha} from './crypto';
import {lineSettings} from './line-settings';
import {loadOrderRoundSettings} from './order-round-settings';
import {bookedSalesReport} from './booked-sales';
import {lastClosedProfitRound,profitReportText} from './profit-report-message';

export async function createProfitReportBinding(actor:string){
 const connection=await lineSettings();
 if(!connection?.settings.accessToken)throw Error('LINE_NOT_READY');
 const code=randomBytes(12).toString('hex');
 const expiresAt=new Date(Date.now()+15*60000);
 await transaction(async tx=>{
  await userLock(tx,'owner-profit-report');
  await tx.ownerProfitReport.upsert({where:{id:actor},create:{id:actor,bindingHash:sha(code),bindingExpiresAt:expiresAt},update:{bindingHash:sha(code),bindingExpiresAt:expiresAt}});
 });
 return {code,expiresAt};
}
export async function bindProfitReportRecipient(input:{botId:string;userId:string;text:string}){
 const match=input.text.trim().match(/^ผูกรายงาน\s+([a-f0-9]{24})$/i);
 if(!match)return false;
 return transaction(async tx=>{
  await userLock(tx,'owner-profit-report');
  const setting=await tx.ownerProfitReport.findUnique({where:{bindingHash:sha(match[1].toLowerCase())}});
  if(!setting?.bindingExpiresAt||setting.bindingExpiresAt<=new Date())return false;
  await tx.ownerProfitReport.update({where:{id:setting.id},data:{recipientUserId:input.userId,botId:input.botId,enabled:true,enabledAt:new Date(),bindingHash:null,bindingExpiresAt:null}});
  await tx.auditLog.create({data:{actor:setting.id,action:'PROFIT_REPORT_LINKED',entityId:setting.id,details:{enabled:true}}});
  return true;
 });
}
export async function toggleProfitReport(actor:string,enabled:boolean){
 return transaction(async tx=>{
  await userLock(tx,'owner-profit-report');
  const setting=await tx.ownerProfitReport.findUnique({where:{id:actor}});
  if(!setting?.recipientUserId||!setting.botId)throw Error('LINE_NOT_LINKED');
  await tx.ownerProfitReport.update({where:{id:actor},data:{enabled,enabledAt:enabled?new Date():setting.enabledAt}});
  await tx.auditLog.create({data:{actor,action:'PROFIT_REPORT_UPDATED',entityId:actor,details:{enabled}}});
 });
}
export async function sendDueProfitReport(now=new Date()){
 const setting=await db.ownerProfitReport.findUnique({where:{id:'owner'}});
 if(!setting?.enabled||!setting.recipientUserId||!setting.botId||!setting.enabledAt)return {status:'disabled'};
 const connection=await lineSettings();
 if(connection?.settings.botId!==setting.botId||!connection.settings.accessToken)return {status:'line-unavailable'};
 const round=await loadOrderRoundSettings();
 const closed=lastClosedProfitRound(now,round.closeMinutes);
 if(setting.enabledAt>closed.end)return {status:'not-due'};
 const existing=await db.profitReportDelivery.findUnique({where:{day:closed.day}});
 if(existing?.status==='SENT'||existing?.status==='CANCELLED'||existing?.status==='REJECTED'||existing&&existing.attempts>=5)return {status:'finished'};
 if(existing?.lastAttemptAt&&+now-+existing.lastAttemptAt<60000)return {status:'retry-later'};
 if(existing?.leaseUntil&&existing.leaseUntil>now)return {status:'busy'};
 let text=existing?.text;
 if(!text){const report=await bookedSalesReport({from:closed.day,to:closed.day},now);text=profitReportText(closed.day,round.closeTime,report.summary);}
 const delivery=await transaction(async tx=>{
  await userLock(tx,'owner-profit-report');
  const current=await tx.ownerProfitReport.findUnique({where:{id:'owner'}});
  if(!current?.enabled||current.recipientUserId!==setting.recipientUserId||current.botId!==setting.botId)return null;
  let row=await tx.profitReportDelivery.findUnique({where:{day:closed.day}});
  if(row?.status==='SENT'||row?.status==='CANCELLED'||row?.status==='REJECTED'||row&&row.attempts>=5||row?.leaseUntil&&row.leaseUntil>now)return null;
  if(row&&(row.recipientUserId!==setting.recipientUserId||row.botId!==setting.botId)){
   await tx.profitReportDelivery.update({where:{day:closed.day},data:{status:'CANCELLED',lastError:'RECIPIENT_CHANGED'}});return null;
  }
  if(!row)row=await tx.profitReportDelivery.create({data:{day:closed.day,recipientUserId:setting.recipientUserId!,botId:setting.botId!,text:text!,retryKey:randomUUID()}});
  return tx.profitReportDelivery.update({where:{day:closed.day},data:{status:'SENDING',attempts:{increment:1},lastAttemptAt:now,leaseUntil:new Date(+now+90000)}});
 });
 if(!delivery)return {status:'busy'};
 try{
  const response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+connection.settings.accessToken,'Content-Type':'application/json','X-Line-Retry-Key':delivery.retryKey},body:JSON.stringify({to:delivery.recipientUserId,messages:[{type:'text',text:delivery.text}]}),signal:AbortSignal.timeout(10000),cache:'no-store'});
  const accepted=response.ok||response.status===409&&!!response.headers.get('x-line-accepted-request-id');
  await db.profitReportDelivery.update({where:{day:delivery.day},data:{status:accepted?'SENT':response.status>=400&&response.status<500?'REJECTED':'FAILED',sentAt:accepted?new Date():null,leaseUntil:null,lastError:accepted?null:'LINE_HTTP_'+response.status}});
  return {status:accepted?'sent':'failed'};
 }catch{
  await db.profitReportDelivery.update({where:{day:delivery.day},data:{status:'FAILED',leaseUntil:null,lastError:'DELIVERY_UNCONFIRMED'}});
  return {status:'failed'};
 }
}
