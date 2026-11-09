import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shippingSummaryText,shippingAmountLabel,shippingPaymentLabel} from '../src/lib/order-shipping-summary';
test('shipping copy includes recipient, contact, items, amount, payment and tracking',()=>{
 const text=shippingSummaryText({orderNumber:'ORDER-1',recipient:'Customer',phone:'0800000000',address:'Shipping address',payment:'COD',amountSatang:123456,tracking:'TRACKING-1',seller:'seller',items:[{code:'ITEM-1',name:'Product',quantityMilliG:1250}]});
 for(const part of ['ORDER-1','Customer','0800000000','Shipping address','ITEM-1 · Product × 1.25 กรัม','1,234.56 บาท','เก็บเงินปลายทาง (COD)','TRACKING-1','seller'])assert.ok(text.includes(part),part);
});
test('missing totals stay unknown and zero totals remain zero',()=>{
 assert.equal(shippingAmountLabel(null),'ยังไม่ทราบยอด');assert.equal(shippingAmountLabel(0),'0.00 บาท');assert.equal(shippingPaymentLabel('โอน'),'โอนเงิน');
});
