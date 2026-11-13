import {createHash} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {db,transaction,userLock,currentDatabaseSchema} from './db';
import {prepareLineCardDraft} from './line-card-draft';
import {researchResult} from './product-research';
import {stockCode} from './stock-code';
import {oaAccountId,chooseOaTarget} from './line-oa-accounts';
import {parseOaProgress} from './line-oa-progress';
import {readOaPreview} from './line-card-preview-token';

export const oaProduct=z.object({code:z.string().min(1).max(12),name:z.string().min(1),description:z.string().max(60).optional(),priceSatang:z.number().int().nonnegative().max(999999999).optional(),images:z.array(z.object({slot:z.number(),url:z.string().nullable()})).length(3),replyTitle:z.string().max(20),keyword:z.string().min(1).max(30),research:researchResult.optional(),selectedReference:z.object({name:z.string().min(1).max(200),url:z.string().url().refine(url=>new URL(url).protocol==='https:')}).optional()});
export const oaPayload=z.object({version:z.literal(1),researchContext:z.string().trim().max(200).optional(),sets:z.array(z.object({title:z.string().max(100),products:z.array(oaProduct).min(1).max(5)})).min(1).max(10)});
export type OaPayload=z.infer<typeof oaPayload>;
export function researchAlternatives(research:z.infer<typeof researchResult>|undefined){
 if(!research?.needsReview)return [];
 return research.alternatives?.length?research.alternatives:research.sources.slice(0,3).map(url=>({name:research.name,url}));
}
export function chooseResearchAlternative(payload:OaPayload,code:string,index:number){
 const products=payload.sets.flatMap(set=>set.products),cursor=products.findIndex(product=>product.code===code);
 const product=products[cursor],choice=researchAlternatives(product?.research)[index];
 if(!Number.isInteger(index)||index<0||!product?.research?.needsReview||!choice)throw Error('OA_ALTERNATIVE_INVALID');
 product.selectedReference={...choice};delete product.research;return cursor;
}
export const oaRequest=z.object({codes:z.array(stockCode).min(1).max(50),requestKey:z.string().uuid(),researchContext:z.string().trim().max(200).optional(),account:oaAccountId.optional(),prepared:z.array(z.object({code:stockCode,token:z.string().min(1).max(32000),confirmed:z.literal(true)})).min(1).max(50).optional()});
export function artifactFingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
export function matchesOaRequest(job:{account:string;payload:Prisma.JsonValue},account:string,codes:string[]){
 return job.account===account&&JSON.stringify(oaPayload.parse(job.payload).sets.flatMap(set=>set.products).map(product=>product.code))===JSON.stringify(codes);
}
export function validateOaPayload(value:unknown){
 const parsed=oaPayload.parse(value),products=parsed.sets.flatMap(s=>s.products);
 if(new Set(products.map(p=>p.code)).size!==products.length)throw Error('OA_DUPLICATE_PRODUCT');
 if(products.some(p=>p.keyword!==p.code||p.replyTitle!=='ข้อมูล '+p.code))throw Error('OA_CODE_MISMATCH');
 if(products.some(p=>p.images.map(i=>i.slot).join(',')!=='1,2,3'))throw Error('OA_IMAGE_SLOTS');
 if(products.some(p=>p.images.some(i=>!i.url)))throw Error('OA_IMAGES_MISSING');
 return parsed;
}
export function publicOaJob(job:{id:string;account?:string;status:string;phase:string;cursor:number;error:string|null;results:Prisma.JsonValue;payload:Prisma.JsonValue;progressLog?:Prisma.JsonValue;progressMessage?:string|null;progressAt?:Date|null;retryCount?:number;nextAttemptAt?:Date|null;createdAt:Date;updatedAt:Date}){
 const parsed=oaPayload.safeParse(job.payload);
 const products=parsed.success?parsed.data.sets.flatMap(set=>set.products):[];
 const current=products[job.cursor];
 const progressMessage=job.progressMessage??(job.status==='RUNNING'&&current?(job.phase==='RESEARCH'?'กำลังค้นข้อมูล ':job.phase==='REPLIES'?'กำลังบันทึกข้อความ ':'กำลังบันทึกการ์ด ')+current.code:undefined);
 const counts={products:products.length,replies:Array.isArray(job.results)?job.results.filter(result=>result&&typeof result==='object'&&!Array.isArray(result)&&result.kind==='reply').length:0,sets:parsed.success?parsed.data.sets.length:0,cards:Array.isArray(job.results)?job.results.filter(result=>result&&typeof result==='object'&&!Array.isArray(result)&&result.kind==='cards').length:0};
 return {id:job.id,account:job.account,retryCount:job.retryCount,nextAttemptAt:job.nextAttemptAt,progressMessage,progressAt:job.progressAt,progress:parseOaProgress(job.progressLog),counts,status:job.status,phase:job.phase,cursor:job.cursor,error:job.error,results:job.results,review:job.status==='AWAITING_REVIEW'&&parsed.success?parsed.data.sets.flatMap(s=>s.products).map(p=>({code:p.code,name:p.name,text:p.research?.text??'',sourceCount:p.research?.sources.length??0,reviewReason:p.research?.needsReview?(p.research.reviewReason??'กรุณาตรวจสอบว่าข้อมูลตรงกับสินค้าที่เลือก'):'',alternatives:researchAlternatives(p.research)})):[],createdAt:job.createdAt,updatedAt:job.updatedAt};
}
export async function createOaJob(actor:string,value:unknown,canChooseOther=false){
 const input=oaRequest.parse(value);
 const connection=await db.lineOaBrowser.findUnique({where:{id:'active'}});
 if(!connection)throw Error('OA_BROWSER_NOT_CONFIGURED');
 const targets=await db.lineOaAccount.findMany({where:{available:true}});
 const account=chooseOaTarget(input.account,connection.account,targets,canChooseOther);
 const matches=(job:{account:string;payload:Prisma.JsonValue})=>matchesOaRequest(job,account,input.codes);
 const old=await db.lineOaJob.findUnique({where:{requestKey:input.requestKey}});if(old){if(!matches(old))throw Error('OA_REQUEST_CHANGED');return publicOaJob(old);}
 const draft=await prepareLineCardDraft({codes:input.codes});
 if(!draft.aiConfigured&&!input.prepared)throw Error('OPENAI_NOT_CONFIGURED');
 const payload=validateOaPayload({version:1,sets:draft.sets,researchContext:input.researchContext});
 if(input.prepared){
  const products=payload.sets.flatMap(set=>set.products);
  if(input.prepared.length!==products.length||new Set(input.prepared.map(item=>item.code)).size!==products.length)throw Error('OA_PREVIEW_CHANGED');
  for(const product of products){
   const prepared=input.prepared.find(item=>item.code===product.code);if(!prepared)throw Error('OA_PREVIEW_CHANGED');
   product.research=readOaPreview(prepared.token,{actor,schema:currentDatabaseSchema(),code:product.code,name:product.name,images:product.images,context:input.researchContext??''});
  }
 }
 return transaction(async tx=>{
  await userLock(tx,'line-oa-create-job');
  if(!await tx.lineOaAccount.findFirst({where:{account,available:true}}))throw Error('OA_TARGET_UNAVAILABLE');
  const replay=await tx.lineOaJob.findUnique({where:{requestKey:input.requestKey}});if(replay){if(!matches(replay))throw Error('OA_REQUEST_CHANGED');return publicOaJob(replay);}
  const pending=await tx.lineOaJob.findMany({where:{account,status:{in:['QUEUED','RUNNING','RETRYING','AWAITING_LOGIN','AWAITING_REVIEW']}}});
  const codes=new Set(payload.sets.flatMap(s=>s.products).map(p=>p.code));if(pending.some(j=>oaPayload.parse(j.payload).sets.flatMap(s=>s.products).some(p=>codes.has(p.code))))throw Error('OA_JOB_ALREADY_PENDING');
  const job=await tx.lineOaJob.create({data:{requestKey:input.requestKey,actor,account,payload:payload as Prisma.InputJsonValue,phase:input.prepared?'REPLIES':'RESEARCH',results:[]}});
  await tx.auditLog.create({data:{actor,action:'LINE_OA_JOB_CREATED',entityId:job.id,details:{codes:input.codes,account,fromPreview:!!input.prepared}}});
  return publicOaJob(job);
 });
}

export async function claimOaJob(){
 return transaction(async tx=>{
  await userLock(tx,'line-oa-job-claim');
  const now=new Date(),connection=await tx.lineOaBrowser.findUnique({where:{id:'active'}});
  if(!connection||connection.status!=='READY'||connection.leaseUntil&&connection.leaseUntil>now)return null;
  const targets=await tx.lineOaAccount.findMany({where:{available:true},select:{account:true}});
  const job=await tx.lineOaJob.findFirst({where:{account:{in:targets.map(target=>target.account)},status:{in:['QUEUED','RUNNING','RETRYING']},AND:[{OR:[{leaseUntil:null},{leaseUntil:{lt:now}}]},{OR:[{nextAttemptAt:null},{nextAttemptAt:{lte:now}}]}]},orderBy:{createdAt:'asc'}});
  if(!job)return null;
  const leaseUntil=new Date(Date.now()+5*60000);
  await tx.lineOaBrowser.update({where:{id:'active'},data:{leaseUntil}});
  return tx.lineOaJob.update({where:{id:job.id},data:{status:'RUNNING',leaseUntil,error:null}});
 });
}




