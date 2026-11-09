import {z} from 'zod';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {roles,office,managers,approvers,stockOperators,stockEditors,home,isEmployeeRole} from '../src/lib/accounts';
function loadRoute(file:string,role:string){
 const exports:any={};
 const mocks:Record<string,unknown>={
  'next/server':{after:()=>{}},'zod':{z},'@/lib/stock-code':{stockCode:z.string()},'@/lib/stock-delete':{},'@/lib/stock-delete-batch':{stockDeleteBatchInput:{safeParse:()=>({success:false})}},
  '@/lib/accounts':{stockOperators,stockEditors},
  '@/lib/auth':{admin:async(allowed=['owner'])=>{if(!allowed.includes(role))throw Error('FORBIDDEN');return 'test-store';},sameOrigin:async()=>{}},
  '@/lib/stock-product-update':{stockProductUpdateInput:{safeParse:()=>({success:false})}},
  '@/lib/stock-dispatch':{},
  '@/lib/stock-cost-update':{stockCostUpdate:{safeParse:()=>({success:false})}},
  '@/lib/stock-input-error':{},
  '@/lib/stock-product-input':{newStockProduct:{safeParse:()=>({success:false,error:{issues:[]}})}},
  '@/lib/stock-google':{},
  '@/lib/manual-shipment-file':{},
  '@/lib/manual-shipments':{importManualShipments:async()=>{throw Error('Invalid test input');}},
  '@/lib/stock-dispatch-worker':{},
  '@/lib/rejected-shipments':{},
 };
 mocks['@/lib/stock-input-error']={stockInputError:()=> 'Invalid test input'};
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:(id:string)=>{assert.ok(id in mocks,id);return mocks[id];},Response,Request,File,Buffer});
 return exports;
}
test('store role has stock-only groups and its own landing page',()=>{
 assert.ok(roles.includes('store'));assert.equal(home('store'),'/store');assert.equal(isEmployeeRole('store'),false);
 for(const group of [office,managers,approvers])assert.equal(group.includes('store'),false);
 assert.ok(stockOperators.includes('store'));assert.ok(stockEditors.includes('store'));
 assert.equal(stockEditors.includes('admin'),false);
});
for(const file of ['src/app/api/admin/stock/route.ts','src/app/api/admin/stock/update/route.ts','src/app/api/admin/stock/cost/route.ts','src/app/api/admin/shipments/upload/route.ts','src/app/api/admin/stock/delete/route.ts','src/app/api/admin/stock/delete-batch/route.ts']){
 test('store can access stock workflow while unrelated staff are denied: '+file,async()=>{
  const request=()=>new Request('https://example.test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal((await loadRoute(file,'store').POST(request())).status,400);
  for(const role of ['employee','sales','viewer','manager'])assert.equal((await loadRoute(file,role).POST(request())).status,403);
 });
}

test('store navigation contains inventory and shipping tasks without finance or user management',async()=>{
 const React=await import('react');const runtime=await import('react/jsx-runtime');const {renderToStaticMarkup}=await import('react-dom/server');const exports:any={};
 const mocks:Record<string,unknown>={
  'react/jsx-runtime':runtime,
  'next/link':{default:({href,children}:any)=>React.createElement('a',{href},children)},
  '@/lib/db':{},'@/lib/stock-review':{},'@/lib/accounts':{office},'@/lib/store-view':{isOwnerStoreView:async()=>false},
  '@/lib/auth':{requireAdminPage:async(allowed:string[])=>{assert.ok(allowed.includes('store'));return {role:'store',username:'store-user'};}},
  '@/lib/config':{},'@/lib/line-settings':{},
  '@/app/sidebar-navigation':{SidebarNavigation:({children}:any)=>React.createElement('nav',{},children)},
  '@/app/sidebar.css':{},'@/app/workspace-location':{},'@/lib/website-orders':{},
 };
 const code=ts.transpileModule(readFileSync('src/app/admin/layout.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require:(id:string)=>{assert.ok(id in mocks,id);return mocks[id];}});
 const html=renderToStaticMarkup(await exports.default({children:React.createElement('p',{},'stock workspace')}));
 for(const href of ['/admin/stock','/admin/stock/history','/admin/store-orders','/admin/orders/upload'])assert.ok(html.includes('href="'+href+'"'));
 for(const href of ['/admin/users','/admin/accounting','/admin/reviews','/admin/income'])assert.ok(!html.includes('href="'+href+'"'));
});

test('owner store preview requires current owner identity and expiry',async()=>{
 const actor={role:'owner',username:'owner',version:'current'};let token:any={purpose:'OWNER_STORE_VIEW',owner:'owner',version:'current',exp:Date.now()+60000};
 const exports:any={};const mocks:Record<string,unknown>={
  'next/headers':{cookies:async()=>({get:()=>({value:'signed'})})},
  './crypto':{readToken:()=>token},'./auth':{requireAdminPage:async()=>actor},'./accounts':{stockOperators},
 };
 const code=ts.transpileModule(readFileSync('src/lib/store-view.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:(id:string)=>mocks[id],Date});
 assert.equal(await exports.isOwnerStoreView(actor),true);assert.equal((await exports.requireStockPage()).role,'store');
 assert.equal(await exports.isOwnerStoreView({...actor,role:'employee'}),false);
 token={...token,version:'old'};assert.equal(await exports.isOwnerStoreView(actor),false);
 token={...token,version:'current',exp:Date.now()-1};assert.equal(await exports.isOwnerStoreView(actor),false);
});
