import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {createOaBatch,oaTargetRequestKey} from '../src/lib/line-oa-batch';
import {latestOaJobs} from '../src/lib/line-oa-job';
const batch='11111111-1111-4111-8111-111111111111';
const product={code:'CUP01',name:'Cup',keyword:'CUP01',replyTitle:'ข้อมูล CUP01',images:[1,2,3].map(slot=>({slot,url:'/test.png'}))};
const payload={version:1 as const,batchKey:batch,batchAccounts:['@one','@two'],sets:[{title:'Test cups',products:[product]}]};
test('multiple OA targets use separate stable requests and retry only failed targets',async t=>{
 const mock=(target:any,key:string,value:any)=>{const old=target[key];target[key]=value;t.after(()=>{target[key]=old;});};
 mock(db.lineOaBrowser,'findUnique',async()=>({account:'@one'}));
 mock(db.lineOaAccount,'findMany',async()=>[{account:'@one',name:'One',available:true},{account:'@two',name:'Two',available:true}]);
 let prior:any=null,fail=true;const stored=new Map<string,any>();
 mock(db.lineOaJob,'findFirst',async()=>prior);
 const enqueue:any=async(_actor:string,input:any)=>{
  if(input.account==='@two'&&fail)throw Error('OA_JOB_ALREADY_PENDING');
  if(!stored.has(input.requestKey))stored.set(input.requestKey,{id:input.account,account:input.account,payload:{...payload,batchAccounts:input.batchAccounts}});
  prior=[...stored.values()][0];return stored.get(input.requestKey);
 };
 const request={requestKey:batch,codes:['CUP01'],accounts:['@one','@two']};
 const first=await createOaBatch('owner',request,true,enqueue);
 assert.equal(first.jobs.length,1);assert.equal(first.failures[0].account,'@two');assert.equal(stored.size,1);
 fail=false;const retry=await createOaBatch('owner',request,true,enqueue);
 assert.equal(retry.jobs.length,2);assert.equal(stored.size,2);assert.equal(retry.failures.length,0);
 assert.notEqual(oaTargetRequestKey(batch,'@one'),oaTargetRequestKey(batch,'@two'));
 assert.equal(oaTargetRequestKey(batch,'@one'),oaTargetRequestKey(batch,'@one'));
 await assert.rejects(createOaBatch('store',request,false,enqueue),/OA_TARGET_FORBIDDEN/);
 await assert.rejects(createOaBatch('owner',{...request,codes:['CUP02']},true,enqueue),/OA_REQUEST_CHANGED/);
 assert.equal(stored.size,2);
});
test('latest queue display keeps only jobs in the newest batch',()=>{
 const recent=[{id:1,payload},{id:2,payload:{...payload,batchKey:'22222222-2222-4222-8222-222222222222'}},{id:3,payload}];
 assert.deepEqual(latestOaJobs(recent).map(item=>item.id),[1,3]);
 const single={id:4,payload:{version:1,sets:payload.sets}};
 assert.deepEqual(latestOaJobs([single,...recent]).map(item=>item.id),[4]);
});
