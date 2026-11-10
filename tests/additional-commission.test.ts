import {test} from 'node:test';import assert from 'node:assert/strict';import {additionalCommissionAmount} from '../src/lib/additional-commission';
test('each payee uses own rate; profit costs are subtracted once and missing costs stay pending',()=>{
 assert.equal(additionalCommissionAmount('REVENUE',500,100000,null),5000);
 assert.equal(additionalCommissionAmount('REVENUE',300,100000,null),3000);
 assert.equal(additionalCommissionAmount('PROFIT',500,100000,40000),3000);
 assert.equal(additionalCommissionAmount('PROFIT',500,100000,null),null);
 assert.equal(additionalCommissionAmount('PROFIT',500,100000,150000),0);
});
test('legacy gross profit uses only product cost and does not wait for freight',()=>{
 assert.equal(additionalCommissionAmount('GROSS_PROFIT',1000,100000,60000,4000),4000);
 assert.equal(additionalCommissionAmount('GROSS_PROFIT',500,100000,60000,4000),2000);
 assert.equal(additionalCommissionAmount('GROSS_PROFIT',1000,100000,60000,null),4000);
 assert.equal(additionalCommissionAmount('GROSS_PROFIT',1000,100000,null,4000),null);
 assert.equal(additionalCommissionAmount('GROSS_PROFIT',1000,100000,60000,0),4000);
 assert.equal(additionalCommissionAmount('GROSS_PROFIT',1000,100000,110000,4000),0);
 assert.equal(additionalCommissionAmount('PROFIT',1000,100000,60000,4000),4000);
});
