import {test} from 'node:test';import assert from 'node:assert/strict';import {additionalCommissionAmount} from '../src/lib/additional-commission';
test('each payee uses own rate; profit costs are subtracted once and missing costs stay pending',()=>{
 assert.equal(additionalCommissionAmount('REVENUE',500,100000,null),5000);
 assert.equal(additionalCommissionAmount('REVENUE',300,100000,null),3000);
 assert.equal(additionalCommissionAmount('PROFIT',500,100000,40000),3000);
 assert.equal(additionalCommissionAmount('PROFIT',500,100000,null),null);
 assert.equal(additionalCommissionAmount('PROFIT',500,100000,150000),0);
});
