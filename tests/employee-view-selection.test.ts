import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function endpoint(role='owner'){
 const cookies:string[]=[];
 const mocks:Record<string,unknown>={
  '@/lib/accounts':{employeeRoles:['employee','sales']},
  'next/server':{NextResponse:{redirect:(url:string,status:number)=>{const response=new Response(null,{status,headers:{location:url}}) as any;response.cookies={set:(name:string)=>cookies.push(name),delete:()=>{}};return response;}}},
  '@/lib/auth':{currentAccount:async()=>({username:'owner',role,version:'v'}),sameOrigin:async()=>{},cookieOptions:{}},
  '@/lib/config':{baseUrl:()=> 'https://example.test'},
  '@/lib/db':{db:{userAccount:{findFirst:async()=>({username:'seller'})}}},
  '@/lib/crypto':{signToken:()=> 'signed'},
  '@/lib/employee-view':{ownerEmployeeCookie:'owner_employee_view'},
 };
 const exports:any={};
 const code=ts.transpileModule(readFileSync('src/app/api/admin/employee-view/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in mocks,name);return mocks[name];},Response,URL});
 return {post:exports.POST,cookies};
}
const request=(returnTo:string)=>new Request('https://example.test/api/admin/employee-view',{method:'POST',body:new URLSearchParams({username:'seller',returnTo})});
test('employee selection retains the current employee page and order scope',async()=>{
 const route=endpoint();const response=await route.post(request('/my-performance/orders?scope=mine&page=1'));
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),'https://example.test/my-performance/orders?scope=mine&page=1');assert.deepEqual(route.cookies,['owner_employee_view']);
});
test('employee selection refuses external and non-employee return destinations',async()=>{
 for(const destination of ['https://outside.test/my-performance','/admin/users','//outside.test/my-performance']){
  const response=await endpoint().post(request(destination));assert.equal(response.headers.get('location'),'https://example.test/my-performance');
 }
 assert.equal((await endpoint('employee').post(request('/my-performance'))).status,403);
});
