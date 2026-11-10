import {currentShopSlug} from './db';
import {shopPath} from './shop-session';
import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {baseUrl,env} from './config';
import {equal} from './crypto';
import {db} from './db';
export const stockReturnJob=z.object({trackings:z.array(z.string().regex(/^[A-Z0-9-]{8,50}$/)).max(100)});
const key=()=>createHmac('sha256',env('SESSION_SECRET')).update('stock-return-worker/v1').digest('hex');
export const validStockReturnWorker=(value:string|null)=>!!value&&equal(value,key());
export async function enqueueStockReturns(trackings:string[]){
 if(!trackings.length)return;
 const response=await fetch(baseUrl()+(currentShopSlug()?shopPath(currentShopSlug()!):'')+'/api/internal/stock/returns',{method:'POST',headers:{'Content-Type':'application/json','x-stock-worker-key':key()},body:JSON.stringify(stockReturnJob.parse({trackings:[...new Set(trackings)]})),signal:AbortSignal.timeout(4000),cache:'no-store'});
 if(!response.ok)throw Error('STOCK_RETURN_WORKER_UNAVAILABLE');
}
export async function enqueuePendingStockReturns(){
 const rows=await db.stockReturn.findMany({where:{stage:'RECEIVED',status:{in:['PENDING','NEEDS_REVIEW']}},orderBy:{updatedAt:'asc'},take:100,select:{tracking:true}});
 await enqueueStockReturns(rows.map(r=>r.tracking));
}
