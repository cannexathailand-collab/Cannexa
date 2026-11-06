import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {runStockDispatchJob,validStockDispatchWorker} from '../src/lib/stock-dispatch-worker';
test('each unique order is attempted once and a waiting cost does not stop later orders',async()=>{
 const seen:string[]=[];
 const enqueue=async(ids:string[])=>runStockDispatchJob(ids,async id=>{seen.push(id);return {status:id==='a'?'WAITING_COST':'POSTED'};},enqueue);
 await enqueue(['a','b','a','c']);assert.deepEqual(seen,['a','b','c']);
});
test('a failed order passes the remaining work along without retrying itself in a loop',async()=>{
 let remaining:string[]=[];
 await assert.rejects(()=>runStockDispatchJob(['a','b','c'],async()=>{throw Error('temporary failure');},async ids=>{remaining=ids;}),/temporary failure/);
 assert.deepEqual(remaining,['b','c']);
});
test('the automatic worker rejects missing or invalid credentials',t=>{
 const before=process.env.SESSION_SECRET;process.env.SESSION_SECRET='worker-test-secret';t.after(()=>{if(before===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=before;});
 assert.equal(validStockDispatchWorker(null),false);assert.equal(validStockDispatchWorker('wrong'),false);
 const key=createHmac('sha256','worker-test-secret').update('stock-dispatch-worker/v1').digest('hex');assert.equal(validStockDispatchWorker(key),true);
});
