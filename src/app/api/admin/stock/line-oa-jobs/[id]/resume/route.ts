import {admin,sameOrigin} from '@/lib/auth';
import {stockEditors} from '@/lib/accounts';
import {db,transaction,userLock} from '@/lib/db';
import {oaPayload} from '@/lib/line-oa-job';
import {Prisma} from '@prisma/client';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 let actor:string;try{actor=await admin(stockEditors);await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 const {id}=await params;
 try{const body=await request.json();await transaction(async tx=>{
  await userLock(tx,'line-oa-resume-'+id);const job=await tx.lineOaJob.findUniqueOrThrow({where:{id}});
  if(!['FAILED','AWAITING_REVIEW'].includes(job.status))throw Error('INVALID_STATE');
  let payload=oaPayload.parse(job.payload),phase=job.phase,cursor=job.cursor;
  if(job.status==='AWAITING_REVIEW'){
   if(body.reviewed!==true)throw Error('REVIEW_REQUIRED');
   for(const product of payload.sets.flatMap(s=>s.products)){if(!product.research)throw Error('REVIEW_INCOMPLETE');product.research.needsReview=false;}
   phase='REPLIES';cursor=0;
  }
  await tx.lineOaJob.update({where:{id},data:{status:'QUEUED',error:null,leaseUntil:null,payload:payload as Prisma.InputJsonValue,phase,cursor}});
  await tx.auditLog.create({data:{actor,action:'LINE_OA_JOB_RESUMED',entityId:id,details:{reviewed:body.reviewed===true}}});
 });return Response.json({ok:true});}catch{return Response.json({error:'ยังทำงานนี้ต่อไม่ได้ กรุณารีเฟรชสถานะ'},{status:409});}
}
