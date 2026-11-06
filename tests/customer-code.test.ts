import assert from 'node:assert/strict';import {test} from 'node:test';
import {canonicalCustomerCode,displayCustomerCode} from '../src/lib/customer-code';
test('short customer codes round trip to the same stored customer without renumbering',()=>{
 for(const n of [1,25,123,9999,10000,99999999]){const canonical='CUS-'+String(n).padStart(8,'0'),short=displayCustomerCode(canonical);assert.equal(canonicalCustomerCode(short),canonical);assert.equal(canonicalCustomerCode(canonical),canonical);}
 assert.equal(displayCustomerCode('CUS-00000001'),'C0001');assert.equal(canonicalCustomerCode(' c0025 '),'CUS-00000025');assert.equal(canonicalCustomerCode('C0000'),'C0000');
});
