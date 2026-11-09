import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderProductCost} from '../src/lib/order-product-cost';
const text='สินค้า:\nA1 x 1.5 G\nB1 x 2 G\nชำระเงิน: COD';
test('recorded dispatch cost takes precedence over current prices including zero cost',()=>{
 assert.deepEqual(orderProductCost(text,123,new Map()),{amountSatang:123,estimated:false});
 assert.deepEqual(orderProductCost(text,0,new Map()),{amountSatang:0,estimated:false});
});
test('pending order cost estimates each item in satang with decimal gram rounding',()=>{
 assert.deepEqual(orderProductCost(text,null,new Map([['A1',101],['B1',200]])),{amountSatang:552,estimated:true});
});
test('missing prices and unreadable products remain unknown instead of zero cost',()=>{
 assert.equal(orderProductCost(text,null,new Map([['A1',101]])).amountSatang,null);
 assert.equal(orderProductCost('สินค้า: unknown',null,new Map()).amountSatang,null);
});
