import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const realRequire=createRequire(import.meta.url);
function endpoint({allowed=true,duplicate=false}={}){
 const saved:any[]=[];
 const mocks:Record<string,unknown>={
  '@/lib/meta-ad':{metaAdCode:'meta-ad'},
  'node:crypto':realRequire('node:crypto'),
  'zod':realRequire('zod'),
  'next/server':{NextResponse:{redirect:(url:string,status:number)=>new Response(null,{status,headers:{location:url}})}},
  '@/lib/auth':{admin:async()=>{if(!allowed)throw Error('Forbidden');return 'owner'},sameOrigin:async()=>{}},
  '@/lib/accounts':{roles:['admin','manager','viewer','employee','sales','store'],isEmployeeRole:(role:string)=>['employee','sales'].includes(role)},
  '@/lib/config':{baseUrl:()=> 'https://example.test'},
  '@/lib/crypto':{passwordHash:()=> 'hashed'},
  '@/lib/db':{transaction:async(fn:any)=>fn({affiliate:{findUnique:async()=>{throw Error('Store must not query Affiliate')}},userAccount:{create:async({data}:any)=>{if(duplicate)throw {code:'P2002'};saved.push(data)},update:async({data}:any)=>saved.push(data)},auditLog:{create:async()=>{}}})},
 };
 const helperExports:any={};
 const helperCode=ts.transpileModule(readFileSync('src/lib/save-user-account.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(helperCode,{exports:helperExports,require:(name:string)=>{const key=name.startsWith('./')?'@/lib/'+name.slice(2):name;assert.ok(key in mocks,key);return mocks[key]},Response,URLSearchParams,Error});
 mocks['@/lib/save-user-account']=helperExports;
 const exports:any={};
 const code=ts.transpileModule(readFileSync('src/app/api/admin/users/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in mocks,name);return mocks[name]},Response,URLSearchParams,Error});
 return {post:exports.POST,saved};
}
const request=(fields:Record<string,string>={})=>new Request('https://example.test/api/admin/users',{method:'POST',body:new URLSearchParams({action:'create',username:'Store_One',role:'store',password:'example-pass',active:'on',...fields})});
test('store creation without Affiliate saves normalized account and no Affiliate link',async()=>{const route=endpoint();const response=await route.post(request());assert.equal(new URL(response.headers.get('location')!).searchParams.get('status'),'saved');assert.equal(route.saved[0].username,'store_one');assert.equal(route.saved[0].affiliateId,null);assert.equal(route.saved[0].role,'store');assert.equal(route.saved[0].active,true)});
test('store validation reports duplicate username and short password specifically',async()=>{for(const [route,req,reason] of [[endpoint({duplicate:true}),request(),'duplicate'],[endpoint(),request({password:'short'}),'password']] as const){const response=await route.post(req);assert.equal(new URL(response.headers.get('location')!).searchParams.get('reason'),reason)}});
test('sales role still requires Affiliate and unauthorized account cannot create users',async()=>{const route=endpoint();const response=await route.post(request({role:'employee'}));assert.equal(new URL(response.headers.get('location')!).searchParams.get('reason'),'affiliate');assert.equal(route.saved.length,0);assert.equal((await endpoint({allowed:false}).post(request())).status,403)});
test('store edit allows retaining password without Affiliate',async()=>{const route=endpoint();const response=await route.post(request({action:'edit',password:''}));assert.equal(new URL(response.headers.get('location')!).searchParams.get('status'),'saved');assert.equal(route.saved[0].affiliateId,null);assert.equal(route.saved[0].hash,undefined)});
