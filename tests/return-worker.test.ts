import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {enqueuePendingStockReturns,stockReturnJob,validStockReturnWorker} from '../src/lib/stock-return-worker';

test('automatic return jobs include only unresolved confirmed receipts and use authenticated bounded requests',async t=>{
 const oldEnv={APP_URL:process.env.APP_URL,SESSION_SECRET:process.env.SESSION_SECRET},oldFind=db.stockReturn.findMany,oldFetch=global.fetch;
 process.env.APP_URL='https://returns.test';process.env.SESSION_SECRET='return-worker-test';
 t.after(()=>{db.stockReturn.findMany=oldFind;global.fetch=oldFetch;for(const [name,value]of Object.entries(oldEnv)){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
 db.stockReturn.findMany=(async({where,take}:any)=>{assert.equal(where.stage,'RECEIVED');assert.deepEqual(where.status.in,['PENDING','NEEDS_REVIEW']);assert.equal(take,100);return [{tracking:'WA096250152TH'},{tracking:'WA096250152TH'}];}) as any;
 let count=0;
 global.fetch=(async(input:any,init:any)=>{count++;assert.equal(String(input),'https://returns.test/api/internal/stock/returns');assert.deepEqual(JSON.parse(init.body),{trackings:['WA096250152TH']});assert.equal(validStockReturnWorker(init.headers['x-stock-worker-key']),true);return Response.json({accepted:true},{status:202});}) as any;
 await enqueuePendingStockReturns();assert.equal(count,1);assert.equal(validStockReturnWorker('wrong'),false);assert.equal(validStockReturnWorker(null),false);
 assert.equal(stockReturnJob.safeParse({trackings:Array(101).fill('WA096250152TH')}).success,false);
 assert.equal(stockReturnJob.safeParse({trackings:['../../other']}).success,false);
});
