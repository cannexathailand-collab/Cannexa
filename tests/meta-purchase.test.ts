import {test} from 'node:test';import assert from 'node:assert/strict';import {metaPurchasePayload} from '../src/lib/meta-purchase';
test('Meta purchase freezes exact value, hashes identity, uses one id per distinct order and the same id on retries',()=>{
 const at=new Date('2026-11-07T01:00:00Z');const one=metaPurchasePayload('order-one',at,100000,'fb.1.1700000000000.test','CUS-123');
 assert.equal(one.custom_data.value,1000);assert.equal(one.custom_data.currency,'THB');assert.equal(one.event_name,'Purchase');assert.notEqual(one.user_data.external_id,'CUS-123');
 assert.deepEqual(one,metaPurchasePayload('order-one',at,100000,'fb.1.1700000000000.test','CUS-123'));
 assert.notEqual(one.event_id,metaPurchasePayload('order-two',at,100000,null,'CUS-123').event_id);
 assert.throws(()=>metaPurchasePayload('bad',at,0,null,'CUS-123'));
});
