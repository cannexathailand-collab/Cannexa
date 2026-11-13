import {oaFailureCategory,safeOaResponse} from './line-oa-diagnostics';
import {Prisma} from '@prisma/client';
import {db} from './db';
import {claimOaJob,releaseOaBrowserLease,oaPayload} from './line-oa-job';
import {researchProduct} from './product-research';
import type {Page,Response as BrowserResponse} from 'playwright-core';
import {saveManagerCards,saveManagerReply,verifyManager} from './line-oa-manager';
import {applySelectedProductName} from './line-oa-product-name';
import {currentOaProgress,reportOaProgress,withOaProgress} from './line-oa-progress';
import {oaRetryDelay} from './line-oa-retry';

export async function processOaStep(openPage:()=>Promise<{page:Page;close:()=>Promise<void>}>,concurrency=1){
 const job=await claimOaJob(concurrency);if(!job)return false;
 return withOaProgress(job.id,job.progressLog,async()=>{
 const heartbeat=setInterval(()=>{const until=new Date(Date.now()+5*60000);void Promise.all([db.lineOaJob.updateMany({where:{id:job.id,status:'RUNNING'},data:{leaseUntil:until}}),db.lineOaBrowser.updateMany({where:{id:'active'},data:{leaseUntil:until,heartbeatAt:new Date()}})]).catch(()=>{});},15000);
 let context:Awaited<ReturnType<typeof openPage>>|undefined;
 const networkFailures:NonNullable<ReturnType<typeof safeOaResponse>>[]=[];
 const onResponse=(response:BrowserResponse)=>{try{const failure=safeOaResponse(response.url(),response.status(),response.request().method());if(failure){networkFailures.push(failure);if(networkFailures.length>8)networkFailures.shift();}}catch{}};
 try{
  const payload=oaPayload.parse(job.payload),products=payload.sets.flatMap(s=>s.products);
  let phase=job.phase,cursor=job.cursor,results=Array.isArray(job.results)?job.results:[];
  if(phase==='RESEARCH'){
   await reportOaProgress('กำลังค้นข้อมูล '+products[cursor].code+' · '+products[cursor].name+' ('+(cursor+1)+'/'+products.length+')');
   products[cursor].research=await researchProduct(products[cursor].name,payload.researchContext,products[cursor].selectedReference);
   await reportOaProgress('เตรียมข้อมูล '+products[cursor].code+' แล้ว');
   const remaining=products.findIndex(product=>!product.research);
   if(remaining<0){
    if(products.some(p=>p.research?.needsReview)){await reportOaProgress('รอเลือกหรือยืนยันข้อมูลอ้างอิงก่อนบันทึก');await db.lineOaJob.update({where:{id:job.id},data:{payload:payload as Prisma.InputJsonValue,status:'AWAITING_REVIEW',error:'ผลค้นมีข้อมูลที่ต้องตรวจสอบก่อนบันทึก',leaseUntil:null}});return true;}
    phase='REPLIES';cursor=0;
   }else cursor=remaining;
  }else{
   await reportOaProgress('กำลังเปิด LINE OA '+job.account);
   context=await openPage();context.page.on('response',onResponse);await verifyManager(context.page,job.account,job.targetName);
   if(phase==='REPLIES'){
    const product=products[cursor];
    if(product.selectedReference&&product.selectedReference.name!==product.name){await applySelectedProductName(product.code,product.name,product.selectedReference.name,job.actor);product.name=product.selectedReference.name;}
    results=[...results,await saveManagerReply(context.page,job.account,products[cursor])];await reportOaProgress('ข้อความตอบกลับอัตโนมัติ '+product.code+' สำเร็จแล้ว ('+(cursor+1)+'/'+products.length+')');cursor++;
    if(cursor===products.length){phase='CARDS';cursor=0;}
   }else if(phase==='CARDS'){
    results=[...results,await saveManagerCards(context.page,job.account,payload.sets[cursor])];cursor++;
    if(cursor===payload.sets.length)phase='DONE';
   }else throw Error('OA_PHASE_INVALID');
  }
  if(phase==='DONE')await reportOaProgress('บันทึกและตรวจสอบครบทุกข้อความและการ์ดแล้ว');
  await db.lineOaJob.update({where:{id:job.id},data:{phase,cursor,payload:payload as Prisma.InputJsonValue,results:results as Prisma.InputJsonValue,status:phase==='DONE'?'COMPLETE':'QUEUED',leaseUntil:null,error:null,retryCount:0,nextAttemptAt:null}});
 }catch(e){
  console.error('LINE OA operation failed:',e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'AUTOMATION_FAILED');
  const login=e instanceof Error&&e.message==='OA_LOGIN_REQUIRED';
  const code=e instanceof Error?e.message:'';
  await db.auditLog.create({data:{actor:job.actor,action:'LINE_OA_STEP_FAILED',entityId:job.id,details:{phase:job.phase,cursor:job.cursor,category:oaFailureCategory(e),stage:currentOaProgress()??null,networkFailures}}}).catch(()=>{});
  const operationErrors:Record<string,string>={OA_VIDEO_ORDER_CONTROL_FAILED:'วิดีโอยังไม่อยู่บนสุด แต่ไม่พบปุ่มเลื่อนที่ใช้งานได้',OA_VIDEO_ORDER_MOVE_FAILED:'สั่งเลื่อนวิดีโอแล้ว แต่ LINE OA ยังไม่เปลี่ยนลำดับ',OA_VIDEO_ORDER_POSITION_FAILED:'จัดลำดับวิดีโอแล้วยังยืนยันตำแหน่งบนสุดไม่ได้',OA_ACCOUNT_VERIFY_FAILED:'ยังตรวจยืนยันบัญชีร้านนี้ใน LINE OA ไม่สำเร็จ',OA_REPLY_ACTIVATION_VERIFY_FAILED:'ยังยืนยันการเปิดใช้งานข้อความใน LINE OA ไม่สำเร็จ',DRIVE_RECONNECT:'กรุณาเชื่อม Google Drive ใหม่ก่อนทำต่อ',DRIVE_VIDEO_DUPLICATE:'พบวิดีโอชื่อรหัสเดียวกันหลายไฟล์ใน Drive กรุณาจัดให้เหลือไฟล์เดียวหรือจำกัดโฟลเดอร์',DRIVE_VIDEO_FORMAT:'วิดีโอใน Drive ต้องเป็นไฟล์ MP4',DRIVE_VIDEO_SIZE:'วิดีโอว่างหรือใหญ่กว่า 200 MB',DRIVE_DOWNLOAD_DENIED:'บัญชี Google Drive ไม่มีสิทธิ์ดาวน์โหลดวิดีโอ',DRIVE_SEARCH_FAILED:'ค้น Google Drive ไม่สำเร็จ ตรวจสิทธิ์และการเปิด Drive API'};
  const message=login?'การล็อกอิน LINE OA หมดอายุ กรุณาเชื่อมใหม่':operationErrors[code]??'งานหยุดระหว่าง '+(currentOaProgress()??'การบันทึก')+' · ลองทำต่อจากจุดเดิมได้';
  const retryDelay=oaRetryDelay(e,job.retryCount);
  const retryMessage=retryDelay===null?(job.retryCount>=3?'ลองอัตโนมัติครบ 3 ครั้งแล้วยังไม่ผ่าน · '+message:message):'พบข้อขัดข้อง ระบบจะลองขั้นเดิมอัตโนมัติครั้งที่ '+(job.retryCount+1)+' ใน '+retryDelay/1000+' วินาที · '+message;
  await reportOaProgress(retryMessage);
  await db.lineOaJob.update({where:{id:job.id},data:{status:login?'AWAITING_LOGIN':retryDelay===null?'FAILED':'RETRYING',leaseUntil:null,error:retryMessage,retryCount:retryDelay===null?job.retryCount:job.retryCount+1,nextAttemptAt:retryDelay===null?null:new Date(Date.now()+retryDelay)}});
  // One destination can reject access while the same login still works
  // for other OAs. Pause that job only; each next job verifies its own OA.
 }finally{
  clearInterval(heartbeat);if(context){context.page.off('response',onResponse);await context.close().catch(()=>{});}
  await releaseOaBrowserLease();
 }
 return true;
 });
}
