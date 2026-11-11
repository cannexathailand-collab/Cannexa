import assert from 'node:assert/strict';
import {test} from 'node:test';
import {encryptLineRecipient,decryptLineRecipient,saveLineMessageRecipient} from '../src/lib/line-message-recipient';
import {db} from '../src/lib/db';

test('login updates LINE display name while webhook observations preserve the stored name',async context=>{
 process.env.SESSION_SECRET??='test-only-recipient-encryption-secret';
 const original=db.lineMessageRecipient.upsert;
 context.after(()=>{db.lineMessageRecipient.upsert=original;});
 const calls:any[]=[];
 db.lineMessageRecipient.upsert=(async input=>{calls.push(input);return {} as any;}) as typeof original;
 await saveLineMessageRecipient('key','bot','user',{displayName:'  ชื่อ LINE  '});
 assert.equal(calls[0].create.displayName,'ชื่อ LINE');
 assert.equal(calls[0].update.displayName,'ชื่อ LINE');
 await saveLineMessageRecipient('key','bot','user');
 assert.equal(Object.hasOwn(calls[1].update,'displayName'),false);
 await saveLineMessageRecipient('key','bot','user',{displayName:'ชื่อใหม่'});
 assert.equal(calls[2].update.displayName,'ชื่อใหม่');
 await saveLineMessageRecipient('key','bot','user',{displayName:null});
 assert.equal(Object.hasOwn(calls[3].update,'displayName'),false);
});

test('LINE recipients are encrypted and authenticated against the shop bot and account',()=>{
 process.env.SESSION_SECRET??='test-only-recipient-encryption-secret';
 const encrypted=encryptLineRecipient('test-user','test-bot','test-key');
 assert.equal(decryptLineRecipient(encrypted,'test-bot','test-key'),'test-user');
 assert.notEqual(encrypted,encryptLineRecipient('test-user','test-bot','test-key'));
 assert.ok(!encrypted.includes('test-user'));
 assert.throws(()=>decryptLineRecipient(encrypted,'other-bot','test-key'));
 assert.throws(()=>decryptLineRecipient(encrypted,'test-bot','other-key'));
 const tampered=Buffer.from(encrypted,'base64url');tampered[tampered.length-1]^=1;
 assert.throws(()=>decryptLineRecipient(tampered.toString('base64url'),'test-bot','test-key'));
});
