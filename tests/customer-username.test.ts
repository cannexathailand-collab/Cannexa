import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerUsername} from '../src/lib/customer-username';
test('customer usernames normalize case and Unicode while reserving member codes',()=>{
 assert.equal(customerUsername('  Somchai_1  '),'somchai_1');
 assert.equal(customerUsername('Ｓｏｍｃｈａｉ'),'somchai');
 assert.equal(customerUsername('สมชาย.01'),'สมชาย.01');
 assert.equal(customerUsername('123456'),'123456');
 assert.equal(customerUsername(''),null);
 for(const name of ['owner','ＯＷＮＥＲ','C0001','AA0001','C123456','CUS-00000001','two words','<script>','aa','x'.repeat(33)])assert.throws(()=>customerUsername(name));
});
