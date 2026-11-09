import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerProductPurchases} from '../src/lib/crm-product-purchases';
import type {summarizeCustomerOrders} from '../src/lib/customer-crm';

type Row=ReturnType<typeof summarizeCustomerOrders>['allHistory'][number];
const order=(id:string,rawText:string,recognized=true,excluded=false)=>({order:{id,rawText},recognized,excluded}) as Row;
test('product purchases count each successful order once and total its quantity',()=>{
 const first=order('one','สินค้า: CG1 20 G\nCG1 10 G\nCG2 5 G');
 const result=customerProductPurchases([first,first,order('two','สินค้า: CG1 50 G'),order('pending','สินค้า: CG1 10 G',false),order('returned','สินค้า: CG1 10 G',true,true)]);
 assert.deepEqual(result.get('CG1'),{orders:2,quantityMilliG:80000});
 assert.deepEqual(result.get('CG2'),{orders:1,quantityMilliG:5000});
});
test('unreadable product orders are not assigned to a product',()=>{
 assert.equal(customerProductPurchases([order('bad','สินค้า: missing quantity')]).size,0);
});
