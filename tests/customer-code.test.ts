import assert from 'node:assert/strict';import {test} from 'node:test';
import {canonicalCustomerCode,displayCustomerCode} from '../src/lib/customer-code';
test('short customer codes round trip to the same stored customer without renumbering',()=>{
 for(const n of [1,25,123,9999,10000,99999999]){const canonical='CUS-'+String(n).padStart(8,'0'),short=displayCustomerCode(canonical);assert.equal(canonicalCustomerCode(short),canonical);assert.equal(canonicalCustomerCode(canonical),canonical);}
 assert.equal(displayCustomerCode('CUS-00000001'),'C0001');assert.equal(canonicalCustomerCode(' c0025 '),'CUS-00000025');assert.equal(canonicalCustomerCode('C0000'),'C0000');
});

test('full four-digit blocks advance the prefix without changing customer identity',()=>{
 const cases=[['CUS-00009999','C9999'],['CUS-00010000','D0001'],['CUS-00019998','D9999'],['CUS-00019999','E0001'],['CUS-00239977','A0001'],['CUS-00249976','B0001']];
 for(const [stored,short] of cases){assert.equal(displayCustomerCode(stored),short);assert.equal(canonicalCustomerCode(short),stored);}
 assert.equal(canonicalCustomerCode(' d0001 '),'CUS-00010000');
 assert.equal(canonicalCustomerCode('C10000'),'CUS-00010000');
 assert.equal(canonicalCustomerCode('D0000'),'D0000');
 assert.equal(displayCustomerCode('CUS-00259975'),'AA0001');
 assert.equal(canonicalCustomerCode('AA0001'),'CUS-00259975');
 assert.equal(displayCustomerCode('CUS-00269974'),'AB0001');
 const issued=new Set<string>();
 for(let n=1;n<=26*9999;n++){const stored='CUS-'+String(n).padStart(8,'0'),short=displayCustomerCode(stored);assert.match(short,/^[A-Z]\d{4}$/);assert.ok(!issued.has(short));issued.add(short);assert.equal(canonicalCustomerCode(short),stored);}
});
