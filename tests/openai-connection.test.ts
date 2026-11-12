import {test} from 'node:test';import assert from 'node:assert/strict';
import {db} from '../src/lib/db';import {sealOpenAiKey,unsealOpenAiKey,saveOpenAiConnection} from '../src/lib/openai-connection';
test('OpenAI key is encrypted and never appears in saved audit metadata',async t=>{
 const original={fetch:globalThis.fetch,transaction:db.$transaction,find:db.openAiConnection.findUnique,secret:process.env.SESSION_SECRET};t.after(()=>{globalThis.fetch=original.fetch;db.$transaction=original.transaction;db.openAiConnection.findUnique=original.find;if(original.secret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=original.secret;});
 process.env.SESSION_SECRET='test-openai-encryption';const key='sk-test-only-not-a-real-key';
 const encrypted=sealOpenAiKey(key);assert.notEqual(encrypted,key);assert.equal(unsealOpenAiKey(encrypted),key);
 let saved=false;globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://api.openai.com/v1/models');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer '+key);return Response.json({data:[{id:'gpt-6.1-sol'},{id:'gpt-6-luna'}]});};
 (db as any).$transaction=async(fn:any)=>fn({openAiConnection:{upsert:async({create}:any)=>{assert.equal(unsealOpenAiKey(create.encryptedKey),key);saved=true;}},auditLog:{create:async({data}:any)=>assert.ok(!JSON.stringify(data).includes(key))}});
 await saveOpenAiConnection('owner',{key,model:'gpt-6.1-sol'});assert.equal(saved,true);
 (db.openAiConnection as any).findUnique=async()=>({encryptedKey:encrypted,model:'gpt-6.1-sol'});
 saved=false;await saveOpenAiConnection('owner',{key:'',model:'gpt-6-luna'});assert.equal(saved,true);
 (db.openAiConnection as any).findUnique=async()=>null;
 saved=false;await assert.rejects(saveOpenAiConnection('owner',{key:'',model:'gpt-6-luna'}),/OPENAI_KEY_REJECTED/);assert.equal(saved,false);
 saved=false;await assert.rejects(saveOpenAiConnection('owner',{key,model:'unavailable'}),/OPENAI_MODEL_UNAVAILABLE/);assert.equal(saved,false);
 globalThis.fetch=async()=>Response.json({error:'invalid'},{status:401});await assert.rejects(saveOpenAiConnection('owner',{key,model:'gpt-6.1-sol'}),/OPENAI_KEY_REJECTED/);
});
