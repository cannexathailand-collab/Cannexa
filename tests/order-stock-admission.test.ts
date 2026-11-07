import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unavailableStock} from '../src/lib/order-stock-admission';
import {orderStockItems} from '../src/lib/order-stock-items';
const product={code:'CG13',name:'Test',costSatang:100,receivedQuantity:40,remainingQuantity:40,issuedQuantity:0,completedQuantity:0,sourceRow:3,salePrices:[]};
test('stock admission rejects sold-out, insufficient, unknown and missing stock; accepts exactly available',()=>{
 const items=[{code:'CG13',quantityMilliG:20000}];
 assert.deepEqual(unavailableStock(items,[product]),[]);
 assert.match(unavailableStock(items,[{...product,remainingQuantity:20}])[0],/จำนวนที่จำหน่ายได้ 0 กรัม.*สำรอง 20 กรัม/);
 assert.match(unavailableStock(items,[{...product,remainingQuantity:25}])[0],/จำนวนที่จำหน่ายได้ 5 กรัม/);
 assert.match(unavailableStock(items,[{...product,remainingQuantity:0}])[0],/หมด/);
 assert.match(unavailableStock(items,[{...product,remainingQuantity:0}])[0],/จำนวนที่จำหน่ายได้ 0 กรัม/);
 assert.match(unavailableStock(items,[{...product,remainingQuantity:-10}])[0],/หมด/);
 assert.match(unavailableStock(items,[product],[{code:'CG13',quantityMilliG:1000}])[0],/ไม่พอ/);
 assert.match(unavailableStock(items,[product],[{code:'CG13',quantityMilliG:1000}])[0],/จำนวนที่จำหน่ายได้ 19 กรัม.*สั่ง 20 กรัม/);
 assert.match(unavailableStock(items,[{...product,unverifiedPendingQuantity:1}])[0],/ตรวจสอบ/);
 assert.match(unavailableStock(items,[])[0],/ไม่พบสินค้า/);
});
test('stock item parsing accepts employee forms with colon, grams, multiplication and multi-line items',()=>{
 for(const text of ['สินค้า: CG13 20g','สินค้า: CG13 x 20 G','สินค้า CG13 × 0.02 KG','สินค้า\nCG13 x 20 G\nรหัสลูกค้า: C0001'])assert.deepEqual(orderStockItems(text).items,[{code:'CG13',quantityMilliG:20000}]);
 assert.ok(orderStockItems('สินค้า: CG13').issues.length);
 assert.deepEqual(orderStockItems('สินค้า: CG13 20g\nCG2 10g\nชำระเงิน: COD').items,[{code:'CG13',quantityMilliG:20000},{code:'CG2',quantityMilliG:10000}]);
 assert.ok(orderStockItems('สินค้า: CG13 20g\nCG2 ไม่ทราบจำนวน\nชำระเงิน: COD').issues.length);
});
