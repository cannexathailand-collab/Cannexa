import {bindDatabase} from '@/lib/db';
import {after} from 'next/server';
import {processStockDispatch} from '@/lib/stock-dispatch';
import {enqueueStockDispatches,runStockDispatchJob,stockDispatchJob,validStockDispatchWorker} from '@/lib/stock-dispatch-worker';
export const maxDuration=60;
export async function POST(req:Request){
 if(!validStockDispatchWorker(req.headers.get('x-stock-worker-key')))return new Response('Forbidden',{status:403});
 if(Number(req.headers.get('content-length')??0)>60000)return new Response('Too large',{status:413});
 const job=stockDispatchJob.safeParse(await req.json().catch(()=>null));if(!job.success)return new Response('Invalid job',{status:400});
 after(bindDatabase(async()=>{await runStockDispatchJob(job.data.orderIds,id=>processStockDispatch(id,'stock-auto-worker'),enqueueStockDispatches);}));
 return Response.json({accepted:true},{status:202});
}
