import {test} from 'node:test';import assert from 'node:assert/strict';
import {needsTrackingReview,needsCodReceiptReview} from '../src/lib/order-tracking-review';
import {orderState} from '../src/lib/order-management';
test('tracking review begins strictly after three days and stops when tracking exists',()=>{
 const createdAt=new Date('2026-11-01T03:00:00Z'),order={status:'WAITING_SHIPMENT',createdAt,payment:'โอน',issues:[]};
 assert.equal(needsTrackingReview(order,null,new Date(+createdAt+3*86400000)),false);
 assert.equal(needsTrackingReview(order,null,new Date(+createdAt+3*86400000+1)),true);
 assert.equal(needsTrackingReview(order,'TRACK',new Date(+createdAt+8*86400000)),false);
 assert.equal(orderState(order,undefined,undefined,new Date(+createdAt+4*86400000)),'REVIEW');
 assert.equal(orderState(order,{tracking:'TRACK',fulfillmentStatus:'UNCONFIRMED',dispatchedAt:null},undefined,new Date(+createdAt+4*86400000)),'WAITING');
 for(const status of ['RETURNED','CANCELLED','WITHDRAWN','EXPIRED'])assert.equal(needsTrackingReview({...order,status},null,new Date(+createdAt+9*86400000)),false);
});
test('COD review starts at ten days after confirmed dispatch and clears only for a matching receipt',()=>{
 const dispatchedAt=new Date('2026-11-01T03:00:00Z'),order={status:'MATCHED_SHIPMENT_WAITING_COD',payment:'COD',issues:[]};
 const shipment={tracking:'TRACK',codSatang:10000,fulfillmentStatus:'DISPATCHED',dispatchedAt},at=new Date(+dispatchedAt+10*86400000);
 assert.equal(needsCodReceiptReview(order,shipment,null,new Date(+at-1)),false);
 assert.equal(needsCodReceiptReview(order,shipment,null,at),true);
 assert.equal(needsCodReceiptReview(order,shipment,{tracking:'TRACK',amountSatang:10000},at),false);
 assert.equal(needsCodReceiptReview(order,shipment,{tracking:'TRACK',amountSatang:9000},at),true);
 assert.equal(needsCodReceiptReview(order,{...shipment,fulfillmentStatus:'UNCONFIRMED'},null,at),false);
 assert.equal(needsCodReceiptReview({...order,payment:'โอน'},shipment,null,at),false);
 assert.equal(needsCodReceiptReview({...order,status:'RETURNED'},shipment,null,at),false);
 assert.equal(orderState(order,shipment,{status:'WAITING_COD'},at),'REVIEW');
 assert.equal(orderState(order,shipment,{status:'WAITING_COD'},at,{tracking:'TRACK',amountSatang:10000}),'COD');
});
