import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {friendRetryToken,readFriendRetry} from '../src/lib/customer-friend-gate';
import {signToken} from '../src/lib/crypto';
import {db} from '../src/lib/db';
import {linkPortalCustomer} from '../src/lib/customer-portal';
process.env.SESSION_SECRET??='friend-gate-unit-test';

test('friend retry preserves intent and rejects expired, changed or unsigned state',()=>{
 const data={intent:'CUSTOMER' as const,key:'a'.repeat(64),clickId:null,linkHash:'b'.repeat(64)};
 const token=friendRetryToken(data);
 assert.equal(readFriendRetry(token)?.linkHash,data.linkHash);
 assert.equal(readFriendRetry(token+'x'),null);
 assert.equal(readFriendRetry(signToken({...data,purpose:'CUSTOMER_FRIEND_RETRY',exp:Date.now()-1})),null);
 assert.equal(readFriendRetry(signToken({...data,intent:'ADMIN',purpose:'CUSTOMER_FRIEND_RETRY',exp:Date.now()+60000})),null);
});

for(const existing of [false,true])for(const status of [false,null,true])for(const intent of ['CUSTOMER','AFFILIATE'])test(`${intent} ${existing ? "returning" : "new"} account friendship: ${status}`,async()=>{
 let linked=0,recorded=0,consumedLink=false;const jar=new Map<string,string>();
 const mocks:Record<string,unknown>={
  '@/lib/customer-login-intent':{customerLoginPurposes:['CUSTOMER'],customerLoginDestination:()=>'/customer'},
  '@/lib/customer-friend-gate':{friendRetryCookie:'retry',friendRetryDuration:600,friendRetryToken:()=>'retry',readFriendRetry:()=>null},
  '@/lib/line-message-recipient':{saveLineMessageRecipient:async()=>{}},
  '@/lib/line-friendship':{verifiedLineFriendship:async()=>status},
  'next/server':{NextResponse:{redirect:(location:string)=>({location,cookies:{set:(name:string,value:string)=>jar.set(name,value),delete:(name:string)=>jar.delete(name)}})}},
  '@/lib/oauth':{consume:async()=>({purpose:intent,clickId:intent==='AFFILIATE'?'click':null,customerLinkHash:'link-hash',lineRevision:'revision'})},
  '@/lib/line':{exchange:async()=>({userId:'user',friendFlag:status,friendshipError:null})},
  '@/lib/tracking':{recordLogin:async()=>{recorded++;return {id:'conversion',clickId:'click'};}},
  '@/lib/crypto':{userKey:()=>'a'.repeat(64),sha:(s:string)=>s,readToken:()=>null},
  '@/lib/config':{baseUrl:()=>'https://example.test',mockMode:()=>false},
  '@/lib/db':{db:{customer:{findUnique:async()=>existing?{code:'C1'}:null},oAuthAttempt:{findUnique:async()=>({purpose:intent})},click:{findUniqueOrThrow:async()=>({metaFbc:null})}}},
  '@/lib/customer-code-message':{syncLoginCustomer:async()=>{linked++;}},
  '@/lib/line-settings':{lineSettings:async()=>({revision:'revision',settings:{botId:'bot',basicId:'@bot'}})},
  '@/lib/line-customer-destination':{lineCustomerDestination:()=>'/line'},
  '@/lib/customer-portal':{portalCookie:'portal',portalAccessCookie:'access',portalPasswordCookie:'password',portalDuration:600,portalToken:()=>'token',portalAccessToken:()=>'access',linkPortalCustomer:async()=>{linked++;consumedLink=true;return {code:'C1',portalRegistrationPending:false,portalProfileIncomplete:false};}},
  '@/lib/auth':{cookieOptions:{}},'@/lib/employee-view':{ownerEmployeeCookie:'employee'},
  '@/lib/customer-marketing':{clearMarketingCustomerSessions:()=>{},marketingCookie:'marketing'},
  '@/lib/customer-age':{customerAgeCookie:'age'},
 };
 const exports:Record<string,any>={};
 vm.runInNewContext(ts.transpileModule(readFileSync('src/app/api/line/callback/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(name:string)=>{assert.ok(name in mocks,name);return mocks[name];},process:{env:{}}});
 const result=await exports.GET({nextUrl:new URL('https://example.test/callback?state='+'x'.repeat(43)+'&code=code'),cookies:{get:()=>undefined}});
 if(status===true||existing){assert.equal(linked,1);assert.equal(recorded,intent==='AFFILIATE'?1:0);assert.equal(jar.has('retry'),false);}
 else {assert.match(result.location,/\/customer\/friendship\?status=/);assert.equal(linked,0);assert.equal(recorded,0);assert.equal(consumedLink,false);assert.equal(jar.has('portal'),false);assert.equal(jar.has('retry'),true);}
});

for(const status of [false,null])test(`an old portal cookie cannot create a customer without friendship ${status}`,async t=>{
 const originals={tx:db.$transaction,event:db.webhookEvent.findFirst,recipient:db.lineMessageRecipient.findUnique};
 t.after(()=>{db.$transaction=originals.tx;db.webhookEvent.findFirst=originals.event;db.lineMessageRecipient.findUnique=originals.recipient;});
 let creates=0;
 db.$transaction=((work:any)=>work({$queryRawUnsafe:async()=>[],customer:{findUnique:async()=>null,create:async()=>{creates++;}},auditLog:{findUnique:async()=>null}})) as typeof db.$transaction;
 db.webhookEvent.findFirst=(async()=>null) as typeof db.webhookEvent.findFirst;
 db.lineMessageRecipient.findUnique=(async()=>status===null?null:{friendFlag:status,friendshipAt:new Date()}) as typeof db.lineMessageRecipient.findUnique;
 await assert.rejects(linkPortalCustomer('a'.repeat(64)),/LINE_FRIENDSHIP_REQUIRED/);assert.equal(creates,0);
});

