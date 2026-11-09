import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function endpoint({role='employee',username='seller',orderSeller='seller',selected=null,blocked=false}:{role?:string;username?:string;orderSeller?:string|null;selected?:{username:string}|null;blocked?:boolean}={}){
 const writes:any[]=[];
 const mocks:Record<string,unknown>={
  'next/server':{after:()=>{}},
  '@/lib/auth':{currentAccount:async()=>({role,username,version:'v'}),sameOrigin:async()=>{}},
  '@/lib/accounts':{isEmployeeRole:(r:string)=>['employee','sales'].includes(r)},
  '@/lib/employee-view':{selectedEmployee:async()=>selected},
  '@/lib/db':{db:{orderIntake:{findUnique:async()=>orderSeller===null?null:{sellerUsername:orderSeller}}}},
  '@/lib/order-changes':{changeOrder:async(actor:string,input:any,_read:any,scope:any)=>{if(blocked)throw Error('จัดส่งแล้ว');writes.push({actor,input,scope});return {id:input.id};}},
  '@/lib/stock-flow':{syncStockReservation:async()=>{}},
 };
 const exports:Record<string,any>={};
 const source=ts.transpileModule(readFileSync('src/app/api/my-performance/orders/cancel/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>{assert.ok(name in mocks,name);return mocks[name];},Response});
 return {post:exports.POST,writes};
}
const request=()=>new Request('https://example.test/cancel',{method:'POST',body:JSON.stringify({id:'order',expectedVersion:'version',requestKey:'key',action:'EDIT',sellerUsername:'seller'})});
test('seller cancellation forces CANCEL and uses authenticated audit identity',async()=>{
 const {post,writes}=endpoint();assert.equal((await post(request())).status,200);assert.equal(writes[0].actor,'seller');assert.equal(writes[0].input.action,'CANCEL');assert.equal(writes[0].scope.sellerUsername,'seller');
});
test('another seller cannot cancel an order by forging its seller in the body',async()=>{
 const {post,writes}=endpoint({username:'other'});assert.equal((await post(request())).status,403);assert.equal(writes.length,0);
});
test('unrelated roles and missing orders are denied',async()=>{
 for(const options of [{role:'viewer'},{orderSeller:null}]){const {post,writes}=endpoint(options);assert.equal((await post(request())).status,403);assert.equal(writes.length,0);}
});
test('owner can cancel across sellers while retaining the owner audit identity',async()=>{
 const {post,writes}=endpoint({role:'owner',username:'owner',selected:{username:'seller'}});assert.equal((await post(request())).status,200);assert.equal(writes[0].actor,'owner');
 const other=endpoint({role:'owner',username:'owner',selected:{username:'other'}});assert.equal((await other.post(request())).status,200);assert.equal(other.writes[0].actor,'owner');assert.equal(other.writes[0].scope,undefined);
});
test('shipment guards from the existing cancellation workflow still apply',async()=>{
 const {post,writes}=endpoint({blocked:true});assert.equal((await post(request())).status,400);assert.equal(writes.length,0);
});
