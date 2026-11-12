import {createHash} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {db,transaction,userLock} from './db';
import {prepareLineCardDraft} from './line-card-draft';
import {researchResult} from './product-research';
import {stockCode} from './stock-code';

export const oaProduct=z.object({code:z.string().min(1).max(12),name:z.string().min(1),images:z.array(z.object({slot:z.number(),url:z.string().nullable()})).length(3),replyTitle:z.string().max(20),keyword:z.string().min(1).max(30),research:researchResult.optional()});
export const oaPayload=z.object({version:z.literal(1),sets:z.array(z.object({title:z.string().max(100),products:z.array(oaProduct).min(1).max(5)})).min(1).max(10)});
export type OaPayload=z.infer<typeof oaPayload>;
export const oaRequest=z.object({codes:z.array(stockCode).min(1).max(50),requestKey:z.string().uuid()});
export function artifactFingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function validateOaPayload(value:unknown){
 const parsed=oaPayload.parse(value),products=parsed.sets.flatMap(s=>s.products);
 if(new Set(products.map(p=>p.code)).size!==products.length)throw Error('OA_DUPLICATE_PRODUCT');
 if(products.some(p=>p.keyword!==p.code||p.replyTitle!=='ข้อมูล '+p.code))throw Error('OA_CODE_MISMATCH');
 if(products.some(p=>p.images.map(i=>i.slot).join(',')!=='1,2,3'))throw Error('OA_IMAGE_SLOTS');
 if(products.some(p=>p.images.some(i=>!i.url)))throw Error('OA_IMAGES_MISSING');
 return parsed;
}
export function publicOaJob(job:{id:string;status:string;phase:string;cursor:number;error:string|null;results:Prisma.JsonValue;payload:Prisma.JsonValue;createdAt:Date;updatedAt:Date}){
 const parsed=oaPayload.safeParse(job.payload);
 return {id:job.id,status:job.status,phase:job.phase,cursor:job.cursor,error:job.error,results:job.results,review:job.status==='AWAITING_REVIEW'&&parsed.success?parsed.data.sets.flatMap(s=>s.products).map(p=>({code:p.code,name:p.name,text:p.research?.text??''})):[],createdAt:job.createdAt,updatedAt:job.updatedAt};
}
export async function createOaJob(actor:string,value:unknown){
 const input=oaRequest.parse(value);
 const old=await db.lineOaJob.findUnique({where:{requestKey:input.requestKey}});if(old){if(JSON.stringify(oaPayload.parse(old.payload).sets.flatMap(s=>s.products).map(p=>p.code))!==JSON.stringify(input.codes))throw Error('OA_REQUEST_CHANGED');return publicOaJob(old);}
 const draft=await prepareLineCardDraft({codes:input.codes});
 if(!draft.account)throw Error('OA_NOT_CONNECTED');
 const account=draft.account;
 if(!draft.aiConfigured)throw Error('OPENAI_NOT_CONFIGURED');
 const connection=await db.lineOaBrowser.findUnique({where:{id:'active'}});
 if(!connection)throw Error('OA_BROWSER_NOT_CONFIGURED');
 if(connection.account!==draft.account)throw Error('OA_ACCOUNT_MISMATCH');
 const payload=validateOaPayload({version:1,sets:draft.sets});
 return transaction(async tx=>{
  await userLock(tx,'line-oa-create-job');
  const replay=await tx.lineOaJob.findUnique({where:{requestKey:input.requestKey}});if(replay)return publicOaJob(replay);
  const pending=await tx.lineOaJob.findMany({where:{account,status:{in:['QUEUED','RUNNING','AWAITING_LOGIN','AWAITING_REVIEW']}}});
  const codes=new Set(payload.sets.flatMap(s=>s.products).map(p=>p.code));if(pending.some(j=>oaPayload.parse(j.payload).sets.flatMap(s=>s.products).some(p=>codes.has(p.code))))throw Error('OA_JOB_ALREADY_PENDING');
  const job=await tx.lineOaJob.create({data:{requestKey:input.requestKey,actor,account:draft.account!,payload:payload as Prisma.InputJsonValue,results:[]}});
  await tx.auditLog.create({data:{actor,action:'LINE_OA_JOB_CREATED',entityId:job.id,details:{codes:input.codes,account:draft.account}}});
  return publicOaJob(job);
 });
}

export async function claimOaJob(){
 return transaction(async tx=>{
  await userLock(tx,'line-oa-job-claim');
  const now=new Date(),connection=await tx.lineOaBrowser.findUnique({where:{id:'active'}});
  if(!connection||connection.status!=='READY'||connection.leaseUntil&&connection.leaseUntil>now)return null;
  const job=await tx.lineOaJob.findFirst({where:{account:connection.account,status:{in:['QUEUED','RUNNING']},OR:[{leaseUntil:null},{leaseUntil:{lt:now}}]},orderBy:{createdAt:'asc'}});
  if(!job)return null;
  const leaseUntil=new Date(Date.now()+5*60000);
  await tx.lineOaBrowser.update({where:{id:'active'},data:{leaseUntil}});
  return tx.lineOaJob.update({where:{id:job.id},data:{status:'RUNNING',leaseUntil,error:null}});
 });
}
