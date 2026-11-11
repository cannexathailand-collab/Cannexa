import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerCategory,customerLicenseNumber} from '../src/lib/customer-category';

test('customer category accepts only general or shop and rejects arbitrary input',()=>{
 assert.equal(customerCategory('GENERAL'),'GENERAL');
 assert.equal(customerCategory('SHOP'),'SHOP');
 assert.equal(customerCategory(undefined),undefined);
 for(const input of ['','owner','<script>',null,{},1])assert.throws(()=>customerCategory(input),/กรุณาเลือกประเภทลูกค้า/);
});
test('only shops must supply a bounded license number; general customers do not retain it',()=>{
 assert.equal(customerLicenseNumber('GENERAL',undefined),null);
 assert.equal(customerLicenseNumber('GENERAL','old-license'),null);
 assert.equal(customerLicenseNumber('SHOP','  LICENSE-123  '),'LICENSE-123');
 for(const input of ['',undefined,null,' '.repeat(10),'a'.repeat(101)])assert.throws(()=>customerLicenseNumber('SHOP',input),/กรุณากรอกเลขที่ใบอนุญาต/);
});
