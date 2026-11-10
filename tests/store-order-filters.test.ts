import test from 'node:test';
import assert from 'node:assert/strict';
import {storeOrderFilters,storeOrderQuery} from '../src/lib/store-order-filters';

test('store order navigation defaults to all orders and preserves status search and page',()=>{
 assert.deepEqual(storeOrderFilters(),{status:'ALL',q:'',page:1});
 const query=storeOrderQuery({status:'SHIPPED',q:'  ลูกค้า & พัสดุ  ',page:'2'});
 assert.deepEqual(storeOrderFilters(Object.fromEntries(new URLSearchParams(query))),{status:'SHIPPED',q:'ลูกค้า & พัสดุ',page:2});
 assert.deepEqual(storeOrderFilters({status:'unknown',q:'x'.repeat(200),page:'-1'}),{status:'ALL',q:'x'.repeat(100),page:1});
});
