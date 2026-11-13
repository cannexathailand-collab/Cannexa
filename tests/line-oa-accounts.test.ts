import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseOaAccountLink,chooseOaTarget,discoverOaAccounts} from '../src/lib/line-oa-accounts';
import {claimOaJob,matchesOaRequest} from '../src/lib/line-oa-job';
import {db} from '../src/lib/db';

test('OA destinations must be discovered and available, and staff cannot switch from the primary OA',()=>{
 const targets=[{account:'@primary',name:'Same name',available:true},{account:'@second',name:'Same name',available:true},{account:'@removed',name:'Removed',available:false}];
 assert.equal(chooseOaTarget('@second','@primary',targets,true),'@second');
 assert.equal(chooseOaTarget(undefined,'@primary',targets,false),'@primary');
 assert.throws(()=>chooseOaTarget('@second','@primary',targets,false),/OA_TARGET_FORBIDDEN/);
 for(const id of ['@unknown','@removed'])assert.throws(()=>chooseOaTarget(id,'@primary',targets,true),/OA_TARGET_UNAVAILABLE/);
 assert.equal(parseOaAccountLink('/account/@second',' Shop ')?.name,'Shop');
 assert.equal(parseOaAccountLink('https://untrusted.example/account/@second','Shop'),null);
 assert.equal(parseOaAccountLink('/account/@second/other','Shop'),null);
});

test('an existing request cannot be replayed into another OA even for the same SKUs',()=>{
 const payload={version:1,sets:[{title:'Test',products:[{code:'A1',name:'Sample',replyTitle:'ข้อมูล A1',keyword:'A1',images:[1,2,3].map(slot=>({slot,url:'https://example.com/image'}))}]}]};
 const job={account:'@primary',payload};
 assert.equal(matchesOaRequest(job,'@primary',['A1']),true);
 assert.equal(matchesOaRequest(job,'@second',['A1']),false);
 assert.equal(matchesOaRequest(job,'@primary',['A2']),false);
});

test('the shared logged-in worker claims jobs for all discovered OAs',async t=>{
 const original=db.$transaction;t.after(()=>{db.$transaction=original;});let queried:any;
 const tx={
  $queryRawUnsafe:async()=>[],
  lineOaBrowser:{findUnique:async()=>({account:'@primary',status:'READY',leaseUntil:null}),update:async()=>({})},
  lineOaAccount:{findMany:async()=>[{account:'@primary'},{account:'@second'}]},
  lineOaJob:{findMany:async()=>[],findFirst:async(args:any)=>{queried=args.where;return {id:'job',account:'@second'};},update:async()=>({id:'job',account:'@second'})},
 };
 (db as any).$transaction=async(fn:any)=>fn(tx);
 assert.equal((await claimOaJob())?.account,'@second');
 assert.deepEqual(queried.account,{in:['@primary','@second']});
});

test('account discovery reads every page and preserves accounts with identical names',async()=>{
 let index=0;
 const pages=[[{href:'/account/@one',name:'Same shop'}],[{href:'/account/@two',name:'Same shop'}]];
 const page:any={goto:async()=>{},waitForTimeout:async()=>{},
  locator:()=>({first:()=>({waitFor:async()=>{}}),evaluateAll:async()=>pages[index]}),
  getByRole:(role:string,options?:any)=>role==='heading'?{waitFor:async()=>{},allTextContents:async()=>['บัญชี(2)']}:{count:async()=>1,evaluate:async()=>index===1,click:async()=>{index++;}},
 };
 const result=await discoverOaAccounts(page);
 assert.deepEqual(result.map(account=>account.account),['@one','@two']);
 assert.equal(result.length,2);
});
