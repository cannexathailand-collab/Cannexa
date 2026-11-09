import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findDuplicateOrders} from '../src/lib/order-duplicates';
const order=(id:string,extra:Record<string,unknown>={})=>({id,orderNumber:'ORDER-'+id,recipient:'Buyer',eventAt:new Date('2026-11-09T10:00:00+07:00'),rawText:'สินค้า AF8 x 10 G\nยอดรวม 490',status:'WAITING_SHIPMENT',paymentSlip:null,...extra});
test('identical same-day orders flag every member and normalize whitespace',()=>{
 const result=findDuplicateOrders([order('one'),order('two',{rawText:'  สินค้า AF8 x 10 G   ยอดรวม 490 '})]);
 assert.equal(result.size,2);assert.equal(result.get('one')?.[0].id,'two');assert.equal(result.get('two')?.[0].id,'one');
});
test('different data and different days do not become same-text duplicate alerts',()=>{
 assert.equal(findDuplicateOrders([order('one'),order('two',{rawText:'different'}),order('three',{eventAt:new Date('2026-11-10T10:00:00+07:00')})]).size,0);
});
test('identical payment slips flag orders across days even when text changed',()=>{
 const result=findDuplicateOrders([order('one',{paymentSlip:{version:'same-image'}}),order('two',{paymentSlip:{version:'same-image'},rawText:'changed',eventAt:new Date('2026-11-10T10:00:00+07:00')})]);
 assert.deepEqual(result.get('one')?.[0].reasons,['แนบรูปสลิปเดียวกัน']);
});
test('both types of evidence merge without duplicate peer links',()=>{
 const result=findDuplicateOrders([order('one',{paymentSlip:{version:'same'}}),order('two',{paymentSlip:{version:'same'}})]);
 assert.equal(result.get('one')?.length,1);assert.equal(result.get('one')?.[0].reasons.length,2);
});
test('closing duplicate records clears the remaining active order alert',()=>{
 for(const status of ['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'])assert.equal(findDuplicateOrders([order('one'),order('two',{status})]).size,0);
});
test('empty text without a payment slip does not create duplicate alerts',()=>{
 assert.equal(findDuplicateOrders([order('one',{rawText:null}),order('two',{rawText:''})]).size,0);
});
test('same customer and goods are flagged across sellers in the same closing round',()=>{
 const text=(seller:string)=>`รหัสผู้ขาย: ${seller}\nรหัสลูกค้า: C0001\nผู้รับ: Buyer\nโทร: 0812345678\nที่อยู่: 1 Bangkok 10200\nสินค้า\nAF8 x 10 G\nยอดรวม: 490\nชำระเงิน: โอน`;
 const result=findDuplicateOrders([order('one',{rawText:text('seller-a'),eventAt:new Date('2026-11-09T23:00:00+07:00')}),order('two',{rawText:text('seller-b'),eventAt:new Date('2026-11-10T09:00:00+07:00')})]);
 assert.equal(result.size,2);assert.equal(result.get('one')?.[0].id,'two');
});
