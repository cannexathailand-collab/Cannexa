import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function endpoint(role='employee',affiliateId:string|null='affiliate',selection:any=null){
 const saved:any[]=[];
 const mocks:Record<string,unknown>={
  'next/server':{after:()=>{}},
  '@/lib/auth':{currentAccount:async()=>({username:'current-user',role,affiliateId}),sameOrigin:async()=>{}},
  '@/lib/accounts':{isEmployeeRole:(value:string)=>['employee','sales'].includes(value)},
  '@/lib/employee-view':{selectedEmployee:async()=>selection},
  '@/lib/manual-orders':{createManualOrder:async(actor:string,input:unknown)=>{saved.push({actor,input});return {orderId:'order',orderNumber:'ORDER'};}},
  '@/lib/order-validation':{orderRejectionText:(reasons:string[])=>reasons.join(' ')},
  '@/lib/stock-flow':{processPendingReservations:async()=>{}},
 };
 const exports:Record<string,any>={};
 const source=ts.transpileModule(readFileSync('src/app/api/my-performance/orders/create/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>{assert.ok(name in mocks,name);return mocks[name];},Response});
 return {post:exports.POST,saved};
}
const request=()=>new Request('https://example.test/create',{method:'POST',body:JSON.stringify({requestKey:'key',sellerCode:'forged-seller',groupId:'group'})});
test('employee creation binds the seller to the authenticated account',async()=>{
 const {post,saved}=endpoint();assert.equal((await post(request())).status,200);assert.equal(saved[0].input.sellerCode,'current-user');assert.equal(saved[0].actor,'current-user');
});
test('owner preview retains owner audit identity and selected employee as seller',async()=>{
 const {post,saved}=endpoint('owner',null,{username:'selected',affiliateId:'affiliate'});assert.equal((await post(request())).status,200);assert.equal(saved[0].input.sellerCode,'selected');assert.equal(saved[0].actor,'current-user');
});
test('unassigned employees and unrelated roles cannot create employee orders',async()=>{
 for(const [role,affiliate] of [['employee',null],['viewer','affiliate'],['owner',null]] as const){const {post,saved}=endpoint(role,affiliate);assert.equal((await post(request())).status,403);assert.equal(saved.length,0);}
});
