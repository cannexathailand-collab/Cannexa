import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptPaymentAmount} from '../src/lib/receipt-payment';

const transfer={payment:'โอน',status:'WAITING_SHIPMENT',withdrawnAt:null};
const parcel={codSatang:12000,status:'MATCHED',fulfillmentStatus:'DISPATCHED'};
test('receipts accept recorded transfers before shipping and require matched COD money',()=>{
 assert.equal(receiptPaymentAmount(transfer,12000,null,null),12000);
 assert.equal(receiptPaymentAmount({...transfer,payment:'COD'},12000,parcel,null),null);
 assert.equal(receiptPaymentAmount({...transfer,payment:'COD'},12000,parcel,11000),null);
 assert.equal(receiptPaymentAmount({...transfer,payment:'COD'},12000,parcel,12000),12000);
});
test('receipts reject closed orders, returns, invalid totals and non-cash orders',()=>{
 for(const status of ['CANCELLED','WITHDRAWN','RETURNED','REJECTED','EXPIRED'])assert.equal(receiptPaymentAmount({...transfer,status},12000,null,null),null);
 for(const amount of [null,0,-1,1.5,NaN,Infinity])assert.equal(receiptPaymentAmount(transfer,amount,null,null),null);
 assert.equal(receiptPaymentAmount({...transfer,payment:'เคลม'},12000,null,null),null);
 assert.equal(receiptPaymentAmount({...transfer,withdrawnAt:new Date()},12000,null,null),null);
 assert.equal(receiptPaymentAmount({...transfer,payment:'COD'},12000,{...parcel,fulfillmentStatus:'RETURNED'},12000),null);
});
