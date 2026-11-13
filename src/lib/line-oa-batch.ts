import {createHash} from 'node:crypto';
import {z} from 'zod';
import {db} from './db';
import {oaAccountId,chooseOaTarget} from './line-oa-accounts';
import {createOaJob,oaRequest,oaPayload} from './line-oa-job';

export const oaBatchRequest=oaRequest.omit({account:true,batchKey:true,batchAccounts:true}).extend({accounts:z.array(oaAccountId).min(1).max(50).refine(values=>new Set(values).size===values.length)});
export function oaTargetRequestKey(batchKey:string,account:string){
 const hash=createHash('sha256').update(batchKey+'\0'+account).digest('hex');
 return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
export async function createOaBatch(actor:string,value:unknown,canChooseOther:boolean,enqueue:typeof createOaJob=createOaJob){
 const input=oaBatchRequest.parse(value);
 const [connection,targets]=await Promise.all([db.lineOaBrowser.findUnique({where:{id:'active'}}),db.lineOaAccount.findMany({where:{available:true}})]);
 if(!connection)throw Error('OA_BROWSER_NOT_CONFIGURED');
 for(const account of input.accounts)chooseOaTarget(account,connection.account,targets,canChooseOther);
 const prior=await db.lineOaJob.findFirst({where:{payload:{path:['batchKey'],equals:input.requestKey}}});
 if(prior){
  const payload=oaPayload.parse(prior.payload);
  if(JSON.stringify(payload.batchAccounts?.slice().sort())!==JSON.stringify(input.accounts.slice().sort())||JSON.stringify(payload.sets.flatMap(set=>set.products.map(product=>product.code)))!==JSON.stringify(input.codes))throw Error('OA_REQUEST_CHANGED');
 }
 const jobs:Awaited<ReturnType<typeof createOaJob>>[]=[],failures:{account:string;name:string;code:string}[]=[];
 for(const account of input.accounts){
  try{jobs.push(await enqueue(actor,{...input,account,batchKey:input.requestKey,batchAccounts:input.accounts,requestKey:oaTargetRequestKey(input.requestKey,account)},canChooseOther));}
  catch(error){failures.push({account,name:targets.find(target=>target.account===account)?.name??account,code:error instanceof Error?error.message:'OA_QUEUE_FAILED'});}
 }
 return {jobs,failures};
}
