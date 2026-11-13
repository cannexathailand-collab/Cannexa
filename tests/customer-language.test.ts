import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerLanguageTools,readCustomerLanguage,resolveCustomerLanguage} from '../src/lib/customer-language';
import {orderSummaryText} from '../src/lib/order-shipping-summary';

test('customer language selection accepts only supported languages',()=>{
 assert.equal(readCustomerLanguage('en'),'en');assert.equal(readCustomerLanguage('th'),'th');
 assert.equal(readCustomerLanguage(undefined),null);assert.equal(readCustomerLanguage('fr'),null);
 assert.equal(resolveCustomerLanguage(undefined),'en');assert.equal(resolveCustomerLanguage('fr'),'en');
 assert.equal(resolveCustomerLanguage('th'),'th');assert.equal(resolveCustomerLanguage('en'),'en');
});
test('customer translations preserve Thai and translate labels, amounts and status messages',()=>{
 const th=customerLanguageTools('th'),en=customerLanguageTools('en');
 assert.equal(th.t('รหัสลูกค้า'),'รหัสลูกค้า');assert.equal(en.t('รหัสลูกค้า'),'Customer ID');
 assert.equal(en.t('  บาท '),'  THB ');assert.equal(en.t('1,200.00 บาท'),'1,200.00 THB');
 assert.equal(en.t('พร้อมแลก 5 ชิ้น'),'Available: 5 items');
 assert.equal(en.t('กรอกข้อมูลสมัครสมาชิก รหัสลูกค้า C0001'),'Complete your registration. Customer ID C0001');
 assert.equal(en.t('ราคาเดิมจากร้าน'),'ราคาเดิมจากร้าน');
 assert.equal(en.t('รหัสลูกค้าหรือรหัสผ่านไม่ถูกต้อง'),'Incorrect customer ID or password.');
});
test('customer dates use Gregorian English and Buddhist Thai while retaining Bangkok dates',()=>{
 const value=new Date('2026-11-10T18:00:00Z');
 assert.ok(customerLanguageTools('en').date(value).includes('2026'));
 assert.ok(customerLanguageTools('th').date(value).includes('2569'));
 assert.equal(customerLanguageTools('en').money(12345),'123.45 THB');
});
test('English order copy localizes labels while keeping original recipient and item data',()=>{
 const data={recipient:'สมชาย',phone:'0812345678',address:'กรุงเทพ',payment:'COD',amountSatang:10000,items:[{code:'A1',name:'สินค้าของร้าน',quantityMilliG:1000}]};
 const details={orderNumber:'ORDER-1',status:'จับคู่สำเร็จ',createdAt:new Date('2026-11-10T00:00:00Z')};
 const english=orderSummaryText(data,details,'en');
 assert.ok(english.includes('Recipient name สมชาย'));assert.ok(english.includes('Total 100.00 THB'));
 assert.ok(english.includes('Cash on delivery (COD)'));assert.ok(english.includes('สินค้าของร้าน'));
 assert.ok(english.includes('Status Tracking matched'));assert.ok(!english.includes('2569'));
 assert.ok(orderSummaryText(data,details).includes('ชื่อผู้รับ สมชาย'));
});
