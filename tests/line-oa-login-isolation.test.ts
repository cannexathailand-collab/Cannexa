import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withDatabase} from '../src/lib/db';
import {processOaStep} from '../src/lib/line-oa-process';

test('a single OA login failure pauses its job without expiring the shared login',async()=>{
 const browser:any={status:'READY',leaseUntil:null};
 const product={code:'CUP1',name:'Cup',keyword:'CUP1',replyTitle:'ข้อมูล CUP1',images:[1,2,3].map(slot=>({slot,url:'https://example.com/image.jpg'}))};
 const job:any={id:'job',account:'@one',actor:'owner',status:'QUEUED',phase:'REPLIES',cursor:0,retryCount:0,progressLog:[],results:[],payload:{version:1,sets:[{title:'Cups',products:[product]}]}};
 const tx:any={auditLog:{create:async()=>({})},$queryRawUnsafe:async()=>[],lineOaBrowser:{findUnique:async()=>browser,update:async({data}:any)=>Object.assign(browser,data),updateMany:async({data}:any)=>{Object.assign(browser,data);return {count:1};}},lineOaAccount:{findMany:async()=>[{account:'@one'}]},lineOaJob:{findMany:async()=>[],findFirst:async()=>job,update:async({data}:any)=>Object.assign(job,data),updateMany:async()=>({count:1})}};
 tx.$transaction=async(fn:any)=>fn(tx);
 const result=await withDatabase(tx,()=>processOaStep(async()=>{throw Error('OA_LOGIN_REQUIRED');},5));
 assert.equal(result,true);assert.equal(job.status,'AWAITING_LOGIN');assert.equal(browser.status,'READY');assert.equal(browser.leaseUntil,null);
});
