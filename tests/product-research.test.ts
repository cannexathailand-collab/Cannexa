import {test} from 'node:test';import assert from 'node:assert/strict';import {db} from '../src/lib/db';import {sealOpenAiKey} from '../src/lib/openai-connection';import {researchProduct} from '../src/lib/product-research';
test('research enforces length and retains suggested URLs for explicit review',async t=>{
 const before={find:db.openAiConnection.findUnique,fetch:globalThis.fetch,secret:process.env.SESSION_SECRET};t.after(()=>{db.openAiConnection.findUnique=before.find;globalThis.fetch=before.fetch;if(before.secret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=before.secret;});
 (db.openAiConnection as any).findUnique=async()=>null;await assert.rejects(researchProduct('Sample'),/OPENAI_NOT_CONFIGURED/);
 process.env.SESSION_SECRET='unit-research';(db.openAiConnection as any).findUnique=async()=>({encryptedKey:sealOpenAiKey('sk-test-only'),model:'test-model'});
 const source='https://example.com/product';let result:any={name:'Sample',text:'Sample information. Source: '+source,sources:[source],needsReview:false};
 let expectedContext:string|undefined;
 globalThis.fetch=async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.equal(JSON.parse(body.input).productContext,expectedContext);assert.equal(body.store,false);assert.deepEqual(body.tools,[{type:'web_search'}]);return Response.json({output:[{type:'web_search_call',action:{sources:[{url:source}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});};
 assert.equal((await researchProduct('Sample')).name,'Sample');
 expectedContext='Computer accessory';await researchProduct('Sample',expectedContext);expectedContext=undefined;
 result={...result,text:'Sample information.'};assert.equal((await researchProduct('Sample')).text,'Sample information.\nSource: '+source);
 result={...result,text:'x'.repeat(490)};await assert.rejects(researchProduct('Sample'),/RESEARCH_INVALID/);
 result={...result,text:'x'.repeat(501)};await assert.rejects(researchProduct('Sample'),/RESEARCH_INVALID/);
 result={...result,text:'Source: https://reference.example.org/item',sources:['https://reference.example.org/item']};const suggested=await researchProduct('Sample');assert.equal(suggested.needsReview,true);assert.equal(suggested.sourceStatus,'suggested');assert.deepEqual(suggested.sources,result.sources);
 result={...result,text:'No matching product was found.',sources:[],needsReview:true};assert.equal((await researchProduct('Sample')).needsReview,true);
 result={...result,needsReview:false};await assert.rejects(researchProduct('Sample'),/RESEARCH_INVALID/);
 result={name:'Example strain',text:'A short source summary.',sources:[source],needsReview:false,strainProfile:{thc:'22%',indicaPercent:40,sativaPercent:60,genetics:'Example parents',aromaFlavor:'Citrus',effects:'Reported relaxation'}};
 const locked=await researchProduct('Example strain');assert.match(locked.text,/Indica 40% \/ Sativa 60% \| THC 22%/);assert.ok(locked.text.endsWith(source));assert.equal(locked.sourceStatus,'verified');
});
