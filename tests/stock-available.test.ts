import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stockAvailableQuantity} from '../src/lib/stock-available';
import {filterStockProducts} from '../src/lib/stock-filters';
test('available stock follows pending issues, handles decimals and retains oversold visibility',()=>{
 assert.equal(stockAvailableQuantity({remainingQuantity:500,issuedQuantity:200,completedQuantity:0}),300);
 assert.equal(stockAvailableQuantity({remainingQuantity:300,issuedQuantity:0,completedQuantity:200}),300);
 assert.equal(stockAvailableQuantity({remainingQuantity:0.3,issuedQuantity:0.1,completedQuantity:0}),0.2);
 assert.equal(stockAvailableQuantity({remainingQuantity:100,issuedQuantity:110,completedQuantity:0}),-10);
 assert.equal(stockAvailableQuantity({remainingQuantity:0,issuedQuantity:200,completedQuantity:0}),-200);
 assert.equal(stockAvailableQuantity({remainingQuantity:-200,issuedQuantity:0,completedQuantity:200}),-200);
 assert.equal(stockAvailableQuantity({remainingQuantity:100,issuedQuantity:null,completedQuantity:0}),null);
 assert.equal(stockAvailableQuantity({remainingQuantity:100,issuedQuantity:20}),100);
 const products=[{code:'A1',name:'Stock',costSatang:0,remainingQuantity:100,issuedQuantity:100,completedQuantity:0}];
 assert.equal(filterStockProducts(products,'','out_of_stock').length,1);
});
