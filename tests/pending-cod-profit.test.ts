import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pendingOrderProfit as pendingCodProfit} from '../src/lib/pending-order-profit';

const row=(id:string,change:Record<string,unknown>={})=>({order:{id,payment:'COD',rawText:'สินค้า:\nA1 x 2 G\nชำระเงิน: COD'},excluded:false,recognized:false,amountSatang:10000,productCostSatang:null,...change});
test('COD estimates use recorded cost first and current product costs for undispatched orders',()=>{
 const result=pendingCodProfit([row('recorded',{productCostSatang:3000}),row('estimate')],new Map([['A1',1000]]));
 assert.deepEqual(result,{count:2,revenueSatang:20000,knownCostSatang:5000,knownProfitSatang:15000,missingCount:0,estimatedCostCount:1,profitSatang:15000});
});
test('received, excluded and non-COD orders stay out of pending COD profit',()=>{
 const transfer={...row('transfer'),order:{id:'transfer',payment:'โอน',rawText:null}};
 const result=pendingCodProfit([row('received',{recognized:true}),row('cancelled',{excluded:true}),transfer],new Map());
 assert.equal(result.count,0);assert.equal(result.profitSatang,0);
});
test('missing cost or revenue remains unknown and duplicate orders count once',()=>{
 const missing=row('missing');
 const result=pendingCodProfit([missing,missing,row('no-amount',{amountSatang:null,productCostSatang:1000})],new Map());
 assert.equal(result.count,2);assert.equal(result.profitSatang,null);assert.equal(result.missingCount,2);
 assert.equal(result.knownProfitSatang,0);
});
test('zero recorded costs and loss-making COD orders remain valid',()=>{
 const result=pendingCodProfit([row('zero',{productCostSatang:0}),row('loss',{productCostSatang:12000})],new Map());
 assert.equal(result.profitSatang,8000);assert.equal(result.estimatedCostCount,0);
});
test('pending transfer estimates stay separate from COD and reconcile with all pending orders',()=>{
 const transfer={...row('transfer',{productCostSatang:4000}),order:{id:'transfer',payment:'โอน',rawText:null}};
 const orders=[row('cod',{productCostSatang:3000}),transfer];
 const cod=pendingCodProfit(orders,new Map());
 const transfers=pendingCodProfit(orders,new Map(),'โอน');
 assert.equal(cod.revenueSatang,10000);assert.equal(transfers.revenueSatang,10000);
 assert.equal(cod.profitSatang!+transfers.profitSatang!,13000);
});
