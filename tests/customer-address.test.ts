import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customerAddress} from '../src/lib/customer-address';

const order=(address:string|null,date:string,status='WAITING_SHIPMENT')=>({address,createdAt:new Date(date),orderNumber:date,status,withdrawnAt:null});
test('customer address prefers the customer record and falls back to the latest linked valid address',()=>{
 const orders=[order('older','2026-11-01'),order('newer','2026-11-02'),order('cancelled','2026-11-03','CANCELLED'),order(' ','2026-11-04')];
 assert.deepEqual(customerAddress('registered',orders),{address:'registered',source:'ทะเบียนลูกค้า'});
 assert.deepEqual(customerAddress(' ',orders),{address:'newer',source:'ที่อยู่จัดส่งในออเดอร์ 2026-11-02'});
 assert.deepEqual(customerAddress(null,[]),{address:null,source:null});
 assert.equal(orders[0].address,'older');
});
