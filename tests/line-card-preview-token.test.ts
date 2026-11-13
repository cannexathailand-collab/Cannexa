import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signOaPreview,readOaPreview} from '../src/lib/line-card-preview-token';
const identity={actor:'tester',schema:'public',code:'TEST01',name:'Test cup',context:'household items',images:[1,2,3].map(slot=>({slot,url:'/image?v='+slot}))};
const research={name:'Test cup',text:'Prepared text, unchanged.',sources:['https://example.com/source'],needsReview:true};
test('confirmed previews retain exact research and reject stale or substituted products and tenants',t=>{
 const secret=process.env.SESSION_SECRET;process.env.SESSION_SECRET='preview-unit-test-secret';
 t.after(()=>{if(secret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=secret;});
 const now=1700000000000,token=signOaPreview({...identity,research},now);
 assert.deepEqual(readOaPreview(token,identity,now),{...research,needsReview:false});
 assert.throws(()=>readOaPreview(token,identity,now+30*60*1000),/OA_PREVIEW_EXPIRED/);
 assert.throws(()=>readOaPreview(token+'x',identity,now),/OA_PREVIEW_EXPIRED/);
 for(const changed of [{actor:'other'},{schema:'shop_other'},{code:'TEST02'},{name:'Other cup'},{context:'changed'},{images:[{slot:1,url:'/changed'}]}])assert.throws(()=>readOaPreview(token,{...identity,...changed},now),/OA_PREVIEW_CHANGED/);
 const unverified=signOaPreview({...identity,research:{...research,sources:[]}},now);
 assert.throws(()=>readOaPreview(unverified,identity,now),/OA_PREVIEW_UNVERIFIED/);
});
