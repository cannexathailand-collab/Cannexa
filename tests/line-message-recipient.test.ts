import assert from 'node:assert/strict';
import {test} from 'node:test';
import {encryptLineRecipient,decryptLineRecipient} from '../src/lib/line-message-recipient';

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
