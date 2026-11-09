import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shippingSummaryText,shippingAmountLabel,shippingPaymentLabel} from '../src/lib/order-shipping-summary';
test('shipping copy contains only recipient, contact, items, amount and payment',()=>{
 const text=shippingSummaryText({recipient:'Customer',phone:'0800000000',address:'Shipping address',payment:'COD',amountSatang:123456,items:[{code:'ITEM-1',name:'Product',quantityMilliG:1250}]});
 for(const part of ['Customer','0800000000','Shipping address','ITEM-1 · Product × 1.25 กรัม','1,234.56 บาท','เก็บเงินปลายทาง (COD)'])assert.ok(text.includes(part),part);
 for(const label of ['เลขออเดอร์','เลขพัสดุ','ผู้ขาย','ข้อความออเดอร์ต้นฉบับ'])assert.ok(!text.includes(label),label);
});
test('missing totals stay unknown and zero totals remain zero',()=>{
 assert.equal(shippingAmountLabel(null),'ยังไม่ทราบยอด');assert.equal(shippingAmountLabel(0),'0.00 บาท');assert.equal(shippingPaymentLabel('โอน'),'โอนเงิน');
});
