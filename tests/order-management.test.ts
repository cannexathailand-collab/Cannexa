import {test} from 'node:test';import assert from 'node:assert/strict';
import {orderState,orderListCsv,orderRoundRange} from '../src/lib/order-management';
test('order management keeps return and cancelled states ahead of stale shipment or sale states',()=>{
 const shipment={fulfillmentStatus:'DISPATCHED',dispatchedAt:new Date()};
 assert.equal(orderState({status:'RETURNED',payment:'COD',issues:[]},shipment,{status:'PAID'}),'RETURNED');
 assert.equal(orderState({status:'WITHDRAWN',payment:'COD',issues:[]},shipment),'CANCELLED');
 assert.equal(orderState({status:'COD_AMOUNT_MISMATCH',payment:'COD',issues:[]},shipment),'REVIEW');
 assert.equal(orderState({status:'MATCHED_SHIPMENT_WAITING_COD',payment:'COD',issues:[]},shipment,{status:'WAITING_COD'}),'COD');
 assert.equal(orderState({status:'MATCHED_SHIPMENT',payment:'โอน',issues:[]},shipment),'SHIPPED');
 assert.equal(orderState({status:'WAITING_SHIPMENT',payment:'โอน',issues:[]}),'WAITING');
});
test('order export uses all filtered rows and quotes formula-like names',()=>{
 const csv=orderListCsv({all:[{order:{orderNumber:'O1',eventAt:new Date('2026-11-07T02:00Z'),recipient:'=SUM(A1)',phone:'081',sellerCode:'A',payment:'COD'},teamName:'Happy Farm',state:'WAITING',amountSatang:12345,shipment:null}]} as any);
 assert.ok(csv.includes('123.45'));assert.ok(csv.includes("'=SUM(A1)"));assert.equal(csv.trim().split('\r\n').length,2);
 assert.ok(csv.includes('ทีม / บ้าน'));assert.ok(csv.includes('Happy Farm'));
});

test('order pages represent separate noon-to-noon Bangkok rounds',()=>{
 const before=orderRoundRange({},new Date('2026-11-07T04:59:59Z'));
 const after=orderRoundRange({},new Date('2026-11-07T05:00:00Z'));
 assert.equal(before.start.toISOString(),'2026-11-06T05:00:00.000Z');
 assert.equal(before.end.toISOString(),after.start.toISOString());
 assert.equal(after.end.toISOString(),'2026-11-08T05:00:00.000Z');
 const page2=orderRoundRange({page:'2'},new Date('2026-11-07T05:00:00Z'));
 assert.equal(page2.start.toISOString(),before.start.toISOString());
 assert.equal(page2.end.toISOString(),after.start.toISOString());
});
