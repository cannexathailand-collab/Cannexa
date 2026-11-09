import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {OrderIntake} from '@prisma/client';
import {summarizeCustomerOrders} from '../src/lib/customer-crm';
import {customerOrderRecency} from '../src/lib/crm-customer-recency';

const now=new Date('2026-11-10T08:00:00+07:00');
const order=(date:string,status='WAITING_SHIPMENT',payment='COD')=>({id:date+status,orderNumber:date,eventAt:new Date(date+'T12:00:00+07:00'),status,payment,withdrawnAt:null,rawText:'ยอดรวม 100'}) as OrderIntake;
test('inactive customer threshold includes 90 days and excludes 89 days and never-ordered customers',()=>{
 assert.equal(customerOrderRecency(summarizeCustomerOrders([order('2026-08-12')],[]).allHistory,now).inactiveThreeMonths,true);
 assert.equal(customerOrderRecency(summarizeCustomerOrders([order('2026-08-13')],[]).allHistory,now).inactiveThreeMonths,false);
 assert.equal(customerOrderRecency([],now).inactiveThreeMonths,false);
});
test('recent valid COD resets inactivity while cancelled orders and claims do not',()=>{
 const old=order('2026-07-01'),recent=order('2026-11-09');
 assert.equal(customerOrderRecency(summarizeCustomerOrders([old,recent],[]).allHistory,now).inactiveThreeMonths,false);
 for(const newer of [order('2026-11-09','CANCELLED'),order('2026-11-09','WITHDRAWN'),order('2026-11-09','EXPIRED'),order('2026-11-09','WAITING_SHIPMENT','เคลม')]){
  assert.equal(customerOrderRecency(summarizeCustomerOrders([old,newer],[]).allHistory,now).inactiveThreeMonths,true);
 }
});
