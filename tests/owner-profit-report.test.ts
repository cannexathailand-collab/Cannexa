import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {lastClosedProfitRound,profitReportText} from '../src/lib/profit-report-message';
const requireReal=createRequire(import.meta.url);
function setup(){
 let setting:any={id:'owner',enabled:true,recipientUserId:'user',botId:'bot',enabledAt:new Date('2026-11-09T00:00Z')};
 let delivery:any=null,calls=0,reads=0;const bodies:any[]=[],retryKeys:any[]=[];
 let fail=false,conflict=false;
 const model={updateMany:async({data}:any)=>{if(delivery)Object.assign(delivery,data);return {count:delivery?1:0}},findUnique:async()=>delivery,create:async({data}:any)=>(delivery={...data,attempts:0,status:'PENDING'}),update:async({data}:any)=>{Object.assign(delivery,{...data,...(data.attempts?{attempts:delivery.attempts+data.attempts.increment}:{})});return {...delivery}}};
 const db={ownerProfitReport:{updateMany:async({data}:any)=>{Object.assign(setting,data);return {count:1}},findUnique:async({where}:any)=>where.bindingHash&&where.bindingHash!==setting.bindingHash?null:setting,update:async({data}:any)=>{Object.assign(setting,data);return setting}},profitReportDelivery:model,auditLog:{create:async()=>{}}};
 let queue=Promise.resolve();
 const mocks:Record<string,unknown>={
  'node:crypto':requireReal('node:crypto'),
  './db':{db,userLock:async()=>{},transaction:(fn:any)=>{const result=queue.then(()=>fn(db));queue=result.catch(()=>{});return result}},
  './crypto':{sha:(value:string)=>'hash-'+value},
  './line-settings':{lineSettings:async()=>({settings:{botId:'bot',accessToken:'test'}})},
  './order-round-settings':{loadOrderRoundSettings:async()=>({closeMinutes:720,closeTime:'12:00'})},
  './booked-sales':{bookedSalesReport:async()=>{reads++;return {summary:{count:1,revenueSatang:10000,transferSatang:10000,codSatang:0,costSatang:6000,profitSatang:4000,estimatedCostCount:0,missingCostCount:0}}}},
  './profit-report-message':{lastClosedProfitRound,profitReportText},
 };
 const exports:any={};const code=ts.transpileModule(readFileSync('src/lib/owner-profit-report.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in mocks,name);return mocks[name]},Date,Error,AbortSignal,fetch:async(_url:string,init:any)=>{calls++;bodies.push(init.body);retryKeys.push(init.headers['X-Line-Retry-Key']);if(fail)throw Error('timeout');return {ok:!conflict,status:conflict?409:200,headers:new Headers(conflict?{'x-line-accepted-request-id':'accepted'}:{})}}});
 return {api:exports,setting,delivery:()=>delivery,calls:()=>calls,reads:()=>reads,bodies,retryKeys,fail:(value:boolean)=>fail=value,conflict:()=>conflict=true};
}
test('daily report waits for cutoff and linked recipient',async()=>{const s=setup();s.setting.enabled=false;await s.api.sendDueProfitReport(new Date('2026-11-10T05:00Z'));assert.equal(s.calls(),0);s.setting.enabled=true;s.setting.enabledAt=new Date('2026-11-10T04:00Z');await s.api.sendDueProfitReport(new Date('2026-11-10T04:59Z'));assert.equal(s.calls(),0)});
test('concurrent daily runs send once and preserve delivery record',async()=>{const s=setup();const now=new Date('2026-11-10T05:00Z');await Promise.all([s.api.sendDueProfitReport(now),s.api.sendDueProfitReport(now)]);await s.api.sendDueProfitReport(new Date('2026-11-10T06:00Z'));assert.equal(s.calls(),1);assert.equal(s.delivery().day,'2026-11-10');assert.equal(s.delivery().status,'SENT')});
test('retry keeps frozen report and retry key after an uncertain response',async()=>{const s=setup();s.fail(true);await s.api.sendDueProfitReport(new Date('2026-11-10T05:00Z'));s.fail(false);s.conflict();await s.api.sendDueProfitReport(new Date('2026-11-10T05:02Z'));assert.equal(s.calls(),2);assert.equal(s.reads(),1);assert.equal(s.bodies[0],s.bodies[1]);assert.equal(s.retryKeys[0],s.retryKeys[1]);assert.equal(s.delivery().status,'SENT')});
test('binding code is consumed once and expires before linking',async()=>{const s=setup();const code='a'.repeat(24);s.setting.bindingHash='hash-'+code;s.setting.bindingExpiresAt=new Date(Date.now()+60000);assert.equal(await s.api.bindProfitReportRecipient({botId:'bot',userId:'new-user',text:'ผูกรายงาน '+code}),true);assert.equal(s.setting.recipientUserId,'new-user');assert.equal(await s.api.bindProfitReportRecipient({botId:'bot',userId:'wrong-user',text:'ผูกรายงาน '+code}),false);s.setting.bindingHash='hash-'+code;s.setting.bindingExpiresAt=new Date(Date.now()-1);assert.equal(await s.api.bindProfitReportRecipient({botId:'bot',userId:'wrong-user',text:'ผูกรายงาน '+code}),false)});

test('unlinking removes recipient and binding and stops future reports',async()=>{const s=setup();s.setting.bindingHash='hash-'+ 'a'.repeat(24);s.setting.bindingExpiresAt=new Date(Date.now()+60000);await s.api.disconnectProfitReport('owner');assert.equal(s.setting.enabled,false);assert.equal(s.setting.recipientUserId,null);assert.equal(s.setting.bindingHash,null);await s.api.sendDueProfitReport(new Date('2026-11-10T05:00Z'));assert.equal(s.calls(),0);assert.equal(await s.api.bindProfitReportRecipient({botId:'bot',userId:'user',text:'ผูกรายงาน '+'a'.repeat(24)}),false)});
