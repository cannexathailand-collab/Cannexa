import {test} from 'node:test';import assert from 'node:assert/strict';
import {db} from '../src/lib/db';import {sealOpenAiKey,unsealOpenAiKey,saveOpenAiConnection} from '../src/lib/openai-connection';
test('OpenAI key is encrypted and never appears in saved audit metadata',async t=>{
 const original={fetch:globalThis.fetch,transaction:db.$transaction,secret:process.env.SESSION_SECRET};t.after(()=>{globalThis.fetch=original.fetch;db.$transaction=original.transaction;if(original.secret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=original.secret;});
 process.env.SESSION_SECRET='test-openai-encryption';const key='sk-test-only-not-a-real-key';
 const encrypted=sealOpenAiKey(key);assert.notEqual(encrypted,key);assert.equal(unsealOpenAiKey(encrypted),key);
 let saved=false;globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://api.openai.com/v1/models');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer '+key);return Response.json({data:[{id:'gpt-4.1'}]});};
 (db as any).$transaction=async(fn:any)=>fn({openAiConnection:{upsert:async({create}:any)=>{assert.equal(unsealOpenAiKey(create.encryptedKey),key);saved=true;}},auditLog:{create:async({data}:any)=>assert.ok(!JSON.stringify(data).includes(key))}});
 await saveOpenAiConnection('owner',{key,model:'gpt-4.1'});assert.equal(saved,true);
 saved=false;await assert.rejects(saveOpenAiConnection('owner',{key,model:'unavailable'}),/OPENAI_MODEL_UNAVAILABLE/);assert.equal(saved,false);
 globalThis.fetch=async()=>Response.json({error:'invalid'},{status:401});await assert.rejects(saveOpenAiConnection('owner',{key,model:'gpt-4.1'}),/OPENAI_KEY_REJECTED/);
});
