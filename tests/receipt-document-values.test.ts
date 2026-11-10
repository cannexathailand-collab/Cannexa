import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pricedReceiptItems,thaiBahtText} from '../src/lib/receipt-document-values';

test('receipt captures item prices only when historical lines reconcile to the received total',()=>{
 const lines=[{code:'ITEM',name:'สินค้า',pack:'10 G',quantity:2,unitPriceSatang:10000,lineTotalSatang:20000}];
 assert.deepEqual(pricedReceiptItems(lines,5000,25000),[
  {description:'ITEM · สินค้า · 10 G',quantity:'2',unitPriceSatang:10000,totalSatang:20000},
  {description:'ค่าจัดส่ง',quantity:'1',unitPriceSatang:5000,totalSatang:5000},
 ]);
 assert.equal(pricedReceiptItems(lines,5000,24000),null);
 assert.equal(pricedReceiptItems([{...lines[0],unitPriceSatang:9999}],5000,25000),null);
 assert.equal(pricedReceiptItems(undefined,0,25000),null);
});

test('Thai receipt totals preserve baht and satang',()=>{
 const examples=new Map([
  [0,'ศูนย์บาทถ้วน'],[100,'หนึ่งบาทถ้วน'],[1100,'สิบเอ็ดบาทถ้วน'],
  [2150,'ยี่สิบเอ็ดบาทห้าสิบสตางค์'],[321000,'สามพันสองร้อยสิบบาทถ้วน'],
  [10100,'หนึ่งร้อยเอ็ดบาทถ้วน'],[100000100,'หนึ่งล้านเอ็ดบาทถ้วน'],
 ]);
 for(const [amount,text]of examples)assert.equal(thaiBahtText(amount),text);
 assert.throws(()=>thaiBahtText(-1));
});
