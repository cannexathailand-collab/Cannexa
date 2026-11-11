import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for(const verifiedFriend of [true,false,null])test('marketing callback uses stable destination for friendship '+verifiedFriend,async()=>{
 const audits:unknown[]=[],cookies=new Map<string,string>();let recordedFriend:unknown;
 const key='a'.repeat(64);
 const mocks:Record<string,unknown>={
  '@/lib/customer-login-intent':{customerLoginPurposes:[],customerLoginDestination:()=>'/customer'},
  '@/lib/line-message-recipient':{saveLineMessageRecipient:async()=>{}},
  '@/lib/line-friendship':{verifiedLineFriendship:async()=>verifiedFriend},
  'next/server':{NextResponse:{redirect:(location:string)=>({location,cookies:{set:(name:string,value:string)=>cookies.set(name,value),delete:(name:string)=>cookies.delete(name)}})}},
  '@/lib/oauth':{consume:async()=>({purpose:'CUSTOMER_MARKETING',clickId:'click',lineRevision:'revision',verifier:'verifier',nonce:'nonce'})},
  '@/lib/line':{exchange:async()=>({userId:'user',friendFlag:null,friendshipError:'HTTP_400'})},
  '@/lib/tracking':{recordLogin:async(_click:string,_key:string,friend:unknown)=>{recordedFriend=friend;return {id:'conversion'};}},
  '@/lib/crypto':{userKey:()=>key,sha:(value:string)=>value,readToken:()=>null},
  '@/lib/config':{baseUrl:()=>'https://example.test',mockMode:()=>false},
  '@/lib/db':{db:{oAuthAttempt:{findUnique:async()=>({purpose:'CUSTOMER_MARKETING'})},click:{findUnique:async()=>({customerLanding:true})},auditLog:{create:async({data}:any)=>audits.push(data)}}},
  '@/lib/customer-code-message':{syncLoginCustomer:async()=>{}},
  '@/lib/line-settings':{lineSettings:async()=>({revision:'revision',settings:{botId:'bot',basicId:'@bot'}})},
  '@/lib/line-customer-destination':{lineCustomerDestination:()=>{throw Error('must not auto-open LINE again');}},
  '@/lib/customer-portal':{portalCookie:'portal',portalAccessCookie:'access',portalPasswordCookie:'password'},
  '@/lib/auth':{cookieOptions:{}},
  '@/lib/employee-view':{ownerEmployeeCookie:'employee'},
  '@/lib/customer-marketing':{clearMarketingCustomerSessions:()=>{},marketingCookie:'marketing',marketingDuration:600,marketingPendingToken:()=>'pending'},
  '@/lib/customer-age':{customerAgeCookie:'age',customerAgeToken:()=>'challenge',customerAgeDuration:600},
 };
 const exports:Record<string,any>={};
 const source=ts.transpileModule(readFileSync('src/app/api/line/callback/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:(name:string)=>{assert.ok(name in mocks,name);return mocks[name];},process:{env:{}}});
 const response=await exports.GET({nextUrl:new URL('https://example.test/api/line/callback?state='+'x'.repeat(43)+'&code=code'),cookies:{get:()=>undefined}});
 assert.equal(response.location,'https://example.test/customer/age');
 assert.equal(cookies.has('age'),true);assert.equal(recordedFriend,null);
 assert.equal(audits.length,1);assert.equal(JSON.parse(JSON.stringify(audits[0])).details.error,'HTTP_400');
});
