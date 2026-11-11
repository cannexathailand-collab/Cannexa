import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerTags} from '../src/lib/customer-tags';
test('internal tags derive from linked customer, referrer and team data',()=>{
 assert.deepEqual(customerTags({legacy:false,lineUserKey:'key',conversionId:null,referrer:{code:'AFF',name:'Seller'}},['Green Hub · Happy Farm','Green Hub · Happy Farm']),['ลูกค้าใหม่','LINE','ผู้แนะนำ: Seller · AFF','ทีม: Green Hub · Happy Farm']);
});
