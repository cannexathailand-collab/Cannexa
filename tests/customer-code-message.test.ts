import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerCodeMessage} from '../src/lib/customer-code-message';
import {customerTags} from '../src/lib/customer-tags';
test('customer code message gives the existing code and clear order instructions',()=>{
 const text=customerCodeMessage('CUS-00000123');assert.ok(text.includes('C0123'));assert.ok(!text.includes('CUS-'));assert.equal(text.split('\n').length,3);assert.ok(text.includes('แจ้งรหัสนี้กับพนักงาน'));assert.ok(text.includes('ใช้รหัสเดิม'));
});
test('internal tags derive from linked customer, referrer and team data',()=>{
 assert.deepEqual(customerTags({legacy:false,lineUserKey:'key',conversionId:null,referrer:{code:'AFF',name:'Seller'}},['Green Hub · Happy Farm','Green Hub · Happy Farm']),['ลูกค้าใหม่','LINE','ผู้แนะนำ: Seller · AFF','ทีม: Green Hub · Happy Farm']);
});
