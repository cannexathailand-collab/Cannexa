import {after} from 'next/server';
import {processStockReturn} from '@/lib/stock-return';
import {enqueueStockReturns,stockReturnJob,validStockReturnWorker} from '@/lib/stock-return-worker';
export const maxDuration=60;
export async function POST(req:Request){
 if(!validStockReturnWorker(req.headers.get('x-stock-worker-key')))return new Response('Forbidden',{status:403});
 if(Number(req.headers.get('content-length')??0)>12000)return new Response('Too large',{status:413});
 const job=stockReturnJob.safeParse(await req.json().catch(()=>null));if(!job.success)return new Response('Invalid job',{status:400});
 after(async()=>{const [tracking,...rest]=[...new Set(job.data.trackings)];try{if(tracking)await processStockReturn(tracking,'stock-return-worker');}finally{await enqueueStockReturns(rest);}});
 return Response.json({accepted:true},{status:202});
}
