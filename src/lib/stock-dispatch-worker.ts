import {currentShopSlug} from './db';
import {shopPath} from './shop-session';
import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {baseUrl,env} from './config';
import {equal} from './crypto';
export const stockDispatchJob=z.object({orderIds:z.array(z.string().min(1).max(200)).max(200)});
const key=()=>createHmac('sha256',env('SESSION_SECRET')).update('stock-dispatch-worker/v1').digest('hex');
export const validStockDispatchWorker=(value:string|null)=>!!value&&equal(value,key());
export async function enqueueStockDispatches(orderIds:string[]){
 const unique=[...new Set(orderIds)];if(!unique.length)return;
 const response=await fetch(baseUrl()+(currentShopSlug()?shopPath(currentShopSlug()!):'')+'/api/internal/stock/dispatch',{method:'POST',headers:{'Content-Type':'application/json','x-stock-worker-key':key()},body:JSON.stringify(stockDispatchJob.parse({orderIds:unique})),signal:AbortSignal.timeout(4000),cache:'no-store'});
 if(!response.ok)throw Error('STOCK_WORKER_UNAVAILABLE');
}
export async function runStockDispatchJob(orderIds:string[],process:(id:string)=>Promise<unknown>,enqueue:(ids:string[])=>Promise<unknown>){
 const [current,...remaining]=[...new Set(orderIds)];if(!current)return;
 // An unresolved order is retained in the database; it must not block the rest of this batch.
 try{await process(current);}finally{if(remaining.length)await enqueue(remaining);}
}
