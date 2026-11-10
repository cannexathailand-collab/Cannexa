import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {withDatabase,currentShopSlug} from '../src/lib/db';

test('background work rotates shops and a Gmail failure does not stop stock or reports',async()=>{
 let nextOffset=0;
 const records:string[]=[];
 const shops=['first','second','third'].map(slug=>({slug,id:slug,schemaName:slug}));
 const root={platformShop:{findMany:async()=>shops},platformJobCursor:{upsert:async()=>({nextOffset}),update:async({data}:{data:{nextOffset:number}})=>{nextOffset=data.nextOffset}}};
 const record=(kind:string)=>async()=>{records.push(kind+':'+currentShopSlug());};
 const mocks:Record<string,unknown>={
  './db':{withDatabase,transaction:async(work:(tx:typeof root)=>Promise<unknown>)=>work(root),userLock:async()=>{}},
  './platform-shops':{shopDatabase:()=>({stockSheetsConnection:{findUnique:async()=>({systemPrimary:false})},gmailConnection:{findUnique:async()=>({encryptedToken:'token',lastSyncAt:null})}})},
  './stock-flow':{processPendingReservations:record('reserve')},
  './stock-dispatch':{processPendingStockDispatches:record('dispatch')},
  './stock-return':{processPendingStockReturns:record('return')},
  './stock-workbook-sync':{syncStockWorkbook:record('sync')},
  './employee-stock-sync':{syncEmployeeStock:record('snapshot')},
  './gmail-reports':{importGmailReports:async()=>{if(currentShopSlug()==='first')throw Error('expired');},matchShipments:record('match')},
  './owner-profit-report':{sendDueProfitReport:record('report')},
 };
 const exports:{runPlatformShopJobs?:()=>Promise<{checked:number;completed:number}>}={};
 const source=ts.transpileModule(readFileSync('src/lib/platform-shop-jobs.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>{assert.ok(name in mocks,name);return mocks[name]},Date,Promise});
 const first=await exports.runPlatformShopJobs!();assert.equal(first.checked,2);assert.equal(first.completed,1);
 assert.ok(records.includes('dispatch:first'));assert.ok(records.includes('report:first'));assert.ok(records.includes('snapshot:second'));
 const second=await exports.runPlatformShopJobs!();assert.equal(second.checked,2);assert.ok(records.includes('dispatch:third'));assert.equal(nextOffset,1);
});
