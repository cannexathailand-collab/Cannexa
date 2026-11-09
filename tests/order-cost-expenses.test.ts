import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimatedOrderCosts,stockCostExpenses} from '../src/lib/stock-cost-expenses';
const date=new Date('2026-11-09T00:00:00+07:00');
const order={id:'order',orderNumber:'ORDER',status:'WAITING_SHIPMENT',rawText:'รายการสินค้า\nA1 x 10 G'};
const dates=new Map([['order',date]]),costs=new Map([['A1',1250]]);
test('accepted orders contribute estimated cost before dispatch and edits update the estimate',()=>{
 const initial=estimatedOrderCosts([order],new Set(),costs,dates);
 assert.equal(initial.entries[0].amountSatang,12500);assert.equal(initial.entries[0].date,date);assert.equal(initial.entries[0].estimated,true);
 assert.equal(estimatedOrderCosts([{...order,rawText:'รายการสินค้า\nA1 x 20 G'}],new Set(),costs,dates).entries[0].amountSatang,25000);
});
test('cancelled orders remove estimates and posted costs replace rather than duplicate them',()=>{
 assert.equal(estimatedOrderCosts([{...order,status:'CANCELLED'}],new Set(),costs,dates).entries.length,0);
 const estimated=estimatedOrderCosts([order],new Set(['order']),costs,dates);
 const actual=stockCostExpenses([{id:'dispatch',orderId:'order',orderNumber:'ORDER',tracking:'TRACK',status:'POSTED',dispatchedAt:date,items:[{code:'A1',quantityMilliG:10000,costSatang:12000}]}],dates);
 assert.equal(estimated.entries.length,0);assert.equal(actual.length,1);assert.equal(actual[0].amountSatang,12000);
});
test('unknown cost remains missing rather than being counted as zero',()=>{
 const result=estimatedOrderCosts([order],new Set(),new Map(),dates);
 assert.equal(result.entries.length,0);assert.deepEqual(result.missingOrderIds,['order']);
});
