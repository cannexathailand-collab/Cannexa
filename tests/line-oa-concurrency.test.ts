import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {claimOaJob,releaseOaBrowserLease} from '../src/lib/line-oa-job';
import {runOaWorkBatch,type OaWorkSession} from '../src/lib/line-oa-work-batch';

test('parallel claims take different OAs, respect the cap, and keep the other OA lease on release',async t=>{
 const original=db.$transaction;t.after(()=>{db.$transaction=original;});
 const jobs:any[]=[{id:'a1',account:'@a',status:'QUEUED',leaseUntil:null},{id:'a2',account:'@a',status:'QUEUED',leaseUntil:null},...['b','c','d','e'].map(key=>({id:key+'1',account:'@'+key,status:'QUEUED',leaseUntil:null}))];
 const browser:any={status:'READY',leaseUntil:null};let tail=Promise.resolve();
 const tx:any={
  $queryRawUnsafe:async(_sql:string,key:string)=>{assert.equal(key,'line-oa-browser-login');return [];},
  lineOaBrowser:{findUnique:async()=>({...browser}),update:async({data}:any)=>Object.assign(browser,data),updateMany:async({data}:any)=>Object.assign(browser,data)},
  lineOaAccount:{findMany:async()=>['a','b','c','d','e'].map(key=>({account:'@'+key}))},
  lineOaJob:{findMany:async()=>jobs.filter(j=>j.status==='RUNNING'&&j.leaseUntil>new Date()),findFirst:async({where}:any)=>jobs.find(j=>where.account.in.includes(j.account)&&(j.leaseUntil===null||j.leaseUntil<new Date())&&['QUEUED','RUNNING','RETRYING'].includes(j.status))??null,update:async({where,data}:any)=>Object.assign(jobs.find(j=>j.id===where.id),data)},
 };
 (db as any).$transaction=(fn:any)=>{const result=tail.then(()=>fn(tx));tail=result.then(()=>{},()=>{});return result;};
 const first=await Promise.all(Array.from({length:5},()=>claimOaJob(5)));
 assert.deepEqual(first.map(j=>j?.account).sort(),['@a','@b','@c','@d','@e']);
 assert.equal(await claimOaJob(5),null);
 jobs[0].status='QUEUED';jobs[0].leaseUntil=null;await releaseOaBrowserLease();
 assert.ok(browser.leaseUntil>=jobs[2].leaseUntil);
 const next=await claimOaJob(5);assert.equal(next?.account,'@a');
 for(const j of jobs){j.status='COMPLETE';j.leaseUntil=null;}await releaseOaBrowserLease();assert.equal(browser.leaseUntil,null);
 browser.leaseUntil=new Date(Date.now()+60000);jobs[0].status='QUEUED';assert.equal(await claimOaJob(5),null);
 await assert.rejects(claimOaJob(6),/OA_CONCURRENCY_INVALID/);
});

test('parallel work uses distinct tabs but persists one shared session after all five finish',async()=>{
 const events:string[]=[];let opened=0,arrived=0;let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});
 const create=async():Promise<OaWorkSession>=>{events.push('session');return {openPage:async()=>{const number=++opened;return {page:{number} as any,close:async()=>{events.push('tab close '+number);}};},close:async()=>{events.push('persist and close session');}};};
 const didWork=await runOaWorkBatch(create,async(open,concurrency)=>{assert.equal(concurrency,5);const tab=await open();events.push('start '+(tab.page as any).number);if(++arrived===5)release();await barrier;await tab.close();return true;});
 assert.ok(didWork);assert.equal(opened,5);assert.equal(events.filter(e=>e==='session').length,1);assert.equal(events.at(-1),'persist and close session');assert.ok(events.indexOf('start 5')<events.indexOf('tab close 1'));
});

test('an idle wave creates no browser session, and a failed slot waits for the other before cleanup',async()=>{
 let sessions=0,closed=false,finished=false,slot=0;
 const create=async():Promise<OaWorkSession>=>{sessions++;return {openPage:async()=>({page:{} as any,close:async()=>{}}),close:async()=>{assert.ok(finished);closed=true;}};};
 assert.equal(await runOaWorkBatch(create,async()=>false),false);assert.equal(sessions,0);
 await assert.rejects(runOaWorkBatch(create,async open=>{if(slot++===0)throw Error('test failure');await open();await Promise.resolve();finished=true;return true;}),/test failure/);
 assert.ok(closed);assert.ok(finished);
});
