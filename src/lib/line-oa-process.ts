import {Prisma} from '@prisma/client';
import {db} from './db';
import {claimOaJob,oaPayload} from './line-oa-job';
import {researchProduct} from './product-research';
import type {Page} from 'playwright-core';
import {saveManagerCards,saveManagerReply,verifyManager} from './line-oa-manager';

export async function processOaStep(openPage:()=>Promise<{page:Page;close:()=>Promise<void>}>){
 const job=await claimOaJob();if(!job)return false;
 const heartbeat=setInterval(()=>{const until=new Date(Date.now()+5*60000);void Promise.all([db.lineOaJob.updateMany({where:{id:job.id,status:'RUNNING'},data:{leaseUntil:until}}),db.lineOaBrowser.updateMany({where:{id:'active'},data:{leaseUntil:until,heartbeatAt:new Date()}})]).catch(()=>{});},15000);
 let context:Awaited<ReturnType<typeof openPage>>|undefined;
 try{
  const payload=oaPayload.parse(job.payload),products=payload.sets.flatMap(s=>s.products);
  let phase=job.phase,cursor=job.cursor,results=Array.isArray(job.results)?job.results:[];
  if(phase==='RESEARCH'){
   products[cursor].research=await researchProduct(products[cursor].name);cursor++;
   if(cursor===products.length){
    if(products.some(p=>p.research?.needsReview)){await db.lineOaJob.update({where:{id:job.id},data:{payload:payload as Prisma.InputJsonValue,status:'AWAITING_REVIEW',error:'ผลค้นมีข้อมูลที่ต้องตรวจสอบก่อนบันทึก',leaseUntil:null}});return true;}
    phase='REPLIES';cursor=0;
   }
  }else{
   context=await openPage();await verifyManager(context.page,job.account);
   if(phase==='REPLIES'){
    results=[...results,await saveManagerReply(context.page,job.account,products[cursor])];cursor++;
    if(cursor===products.length){phase='CARDS';cursor=0;}
   }else if(phase==='CARDS'){
    results=[...results,await saveManagerCards(context.page,job.account,payload.sets[cursor])];cursor++;
    if(cursor===payload.sets.length)phase='DONE';
   }else throw Error('OA_PHASE_INVALID');
  }
  await db.lineOaJob.update({where:{id:job.id},data:{phase,cursor,payload:payload as Prisma.InputJsonValue,results:results as Prisma.InputJsonValue,status:phase==='DONE'?'COMPLETE':'QUEUED',leaseUntil:null,error:null}});
 }catch(e){
  console.error('LINE OA operation failed:',e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'AUTOMATION_FAILED');
  const login=e instanceof Error&&e.message==='OA_LOGIN_REQUIRED';
  await db.lineOaJob.update({where:{id:job.id},data:{status:login?'AWAITING_LOGIN':'FAILED',leaseUntil:null,error:login?'การล็อกอิน LINE OA หมดอายุ กรุณาเชื่อมใหม่':'ยังบันทึกไม่ครบ กรุณาตรวจงานก่อนลองต่อ'}});
  if(login)await db.lineOaBrowser.update({where:{id:'active'},data:{status:'EXPIRED'}});
 }finally{
  clearInterval(heartbeat);if(context)await context.close().catch(()=>{});
  await db.lineOaBrowser.updateMany({where:{id:'active'},data:{leaseUntil:null,heartbeatAt:new Date()}});
 }
 return true;
}
