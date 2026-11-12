import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateOaPayload,artifactFingerprint} from '../src/lib/line-oa-job';
import {oaCommand,sealOaState,unsealOaState,enqueueOaCommand} from '../src/lib/line-oa-browser';
import {db} from '../src/lib/db';
import {managerUrl} from '../src/lib/line-oa-manager';
function product(code:string){return {code,name:'Sample',keyword:code,replyTitle:'ข้อมูล '+code,images:[1,2,3].map(slot=>({slot,url:'/api/stock/'+code+'/image?slot='+slot}))};}
test('OA payload retains partial sets and rejects duplicate, mismatched or missing product assets',()=>{
 const payload={version:1,sets:[{title:'New Arrivals',products:[product('TEST1'),product('TEST2')]}]};
 assert.equal(validateOaPayload(payload).sets[0].products.length,2);
 assert.equal(validateOaPayload({...payload,researchContext:'  Cannabis strain  '}).researchContext,'Cannabis strain');
 assert.throws(()=>validateOaPayload({...payload,researchContext:'x'.repeat(201)}));
 assert.throws(()=>validateOaPayload({...payload,sets:[{title:'duplicate',products:[product('TEST1'),product('TEST1')]}]}),/OA_DUPLICATE_PRODUCT/);
 assert.throws(()=>validateOaPayload({...payload,sets:[{title:'mismatch',products:[{...product('TEST1'),keyword:'TEST2'}]}]}),/OA_CODE_MISMATCH/);
 assert.throws(()=>validateOaPayload({...payload,sets:[{title:'missing',products:[{...product('TEST1'),images:[{slot:1,url:null},{slot:2,url:'x'},{slot:3,url:'y'}]}]}]}),/OA_IMAGES_MISSING/);
 assert.throws(()=>validateOaPayload({...payload,sets:[{title:'slots',products:[{...product('TEST1'),images:[1,1,1].map(slot=>({slot,url:'x'}))}]}]}),/OA_IMAGE_SLOTS/);
 assert.throws(()=>validateOaPayload({...payload,sets:[{title:'too many',products:Array.from({length:6},(_,i)=>product('T'+i))}]}));
 assert.notEqual(artifactFingerprint(product('TEST1')),artifactFingerprint(product('TEST2')));
 assert.throws(()=>managerUrl('@abc/other-account'),/OA_ACCOUNT_INVALID/);
});
test('login state and input commands are encrypted and stale sessions cannot receive input',async t=>{
 const before={secret:process.env.SESSION_SECRET,find:db.lineOaBrowser.findUnique,create:db.lineOaBrowserCommand.create};t.after(()=>{db.lineOaBrowser.findUnique=before.find;db.lineOaBrowserCommand.create=before.create;if(before.secret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=before.secret;});
 process.env.SESSION_SECRET='test-only';const secret={cookies:[{name:'example',value:'private-test-cookie'}]};const encrypted=sealOaState(secret);assert.ok(!encrypted.includes('private-test-cookie'));assert.deepEqual(unsealOaState(encrypted),secret);
 assert.equal(oaCommand.safeParse({action:'click',x:1280,y:0}).success,false);assert.equal(oaCommand.safeParse({action:'goto',url:'https://unrelated.example'}).success,false);
 const sessionId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';let written=false;(db.lineOaBrowser as any).findUnique=async()=>({sessionId,status:'AWAITING_LOGIN',sessionExpiresAt:new Date(Date.now()-1)});(db.lineOaBrowserCommand as any).create=async()=>{written=true;};
 await assert.rejects(enqueueOaCommand({sessionId,command:{action:'type',text:'private'}}),/OA_LOGIN_EXPIRED/);assert.equal(written,false);
});
