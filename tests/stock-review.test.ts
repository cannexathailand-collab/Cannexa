import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stockReviewEntry,stockReviewStatuses} from '../src/lib/stock-review';
import {assertStockReviewChangeable} from '../src/lib/stock-review-actions';
test('failed stock entries show recipient, seller, order items and order revenue instead of product cost',()=>{
 const d={id:'dispatch',orderId:'order',orderNumber:'ORDER-1',status:'NEEDS_REVIEW',candidateTracking:'TRACK1',totalCostSatang:15000,items:[{code:'A1',name:'สินค้า',quantityMilliG:20000}],issues:['ยังบันทึกไม่ได้']};
 const o={orderNumber:'ORDER-1',recipient:'ผู้รับทดสอบ',sellerUsername:'old',payment:'โอน',rawText:'ยอดรวม: 900 บาท'};
 const entry=stockReviewEntry(d,o,{revenueSatang:90000},null,['seller']);
 assert.equal(entry.recipient,'ผู้รับทดสอบ');assert.equal(entry.seller,'seller');assert.equal(entry.salesSatang,90000);assert.equal(entry.items[0].grams,20);assert.equal(entry.statusLabel,'รอตรวจสอบ · ตัดสต๊อกไม่สำเร็จ');assert.deepEqual(entry.issues,['ยังบันทึกไม่ได้']);assert.ok(!stockReviewStatuses.includes('POSTED'));
});
test('review falls back to reserved items and quoted sale total, without inventing missing amounts or claim revenue',()=>{
 const d={orderId:'order',orderNumber:'ORDER',status:'WAITING_COST',items:[],issues:[]},o={recipient:'ผู้รับ',payment:'COD',rawText:'ยอดรวม: 300 บาท',sellerCode:'S1'};
 const entry=stockReviewEntry(d,o,null,{items:[{code:'A1',quantityMilliG:50000}]});assert.equal(entry.salesSatang,30000);assert.equal(entry.items[0].grams,50);assert.equal(entry.seller,'S1');
 assert.equal(stockReviewEntry(d,{...o,payment:'เคลม'},null,null).salesSatang,null);assert.equal(stockReviewEntry(d,null,null,null).salesSatang,null);
});
test('review cannot reset a saved history or uncertain sheet operation',()=>{
 assert.doesNotThrow(()=>assertStockReviewChangeable({status:'NEEDS_REVIEW',historySavedAt:null},null));
 assert.throws(()=>assertStockReviewChangeable({status:'HISTORY_SAVED',historySavedAt:new Date()},null),/NEEDS_VERIFICATION/);
 assert.throws(()=>assertStockReviewChangeable({status:'NEEDS_REVIEW'}, {status:'PREPARED'}),/NEEDS_VERIFICATION/);
 assert.throws(()=>assertStockReviewChangeable({status:'POSTED'},null),/NEEDS_VERIFICATION/);
});
