import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeBookedSales} from '../src/lib/booked-sales';
import {bookedSalesCsv} from '../src/lib/booked-sales-csv';

const order=(id:string,patch:Record<string,unknown>={})=>({id,orderNumber:'ORDER-'+id,eventAt:new Date('2026-11-09T13:00:00+07:00'),rawText:'ยอดรวม: 100.00',status:'WAITING_SHIPMENT',payment:'โอน',sellerUsername:'seller',affiliateId:'affiliate',recipient:'Customer',customer:null,...patch});
const data=(orders:ReturnType<typeof order>[])=>({orders,sales:[],shipments:[],receipts:[],affiliates:[]});
const filter={from:'2026-11-09',to:'2026-11-09'};

test('sales dashboard counts saved unshipped orders after noon on their received day',()=>{
 const report=analyzeBookedSales(data([order('new'),order('second',{payment:'COD'})]),filter);
 assert.equal(report.summary.count,2);
 assert.equal(report.summary.revenueSatang,20000);
 assert.equal(report.summary.transferSatang,10000);
 assert.equal(report.summary.codSatang,10000);
 assert.equal(report.waitingCodCount,1);
 assert.equal(report.detailRows[0].tracking,null);
 assert.equal(report.daily[0].revenueSatang,20000);
});

test('cancelled closed returned and claim orders leave booked sales and repeated customers keep distinct orders',()=>{
 const rows=[order('first'),order('second'),...['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].map(status=>order(status,{status})),order('claim',{payment:'เคลม'})];
 const report=analyzeBookedSales(data(rows),filter);
 assert.equal(report.summary.count,2);assert.equal(report.summary.revenueSatang,20000);
});

test('Bangkok midnight determines received day independently of shipping and closing time',()=>{
 const report=analyzeBookedSales(data([order('late',{eventAt:new Date('2026-11-09T23:59:59+07:00')}),order('next',{eventAt:new Date('2026-11-10T00:00:00+07:00')})]),filter);
 assert.deepEqual(report.orderRows.map(row=>row.id),['late']);
});

test('COD receipts change paid and outstanding buckets while leaving booked revenue unchanged',()=>{
 const dataset={...data([order('cod',{payment:'COD'})]),shipments:[{orderId:'cod',tracking:'TRACK',status:'MATCHED',fulfillmentStatus:'DISPATCHED',dispatchedAt:new Date()}],receipts:[{tracking:'TRACK',amountSatang:10000}]};
 const paid=analyzeBookedSales(dataset,filter),waiting=analyzeBookedSales({...dataset,receipts:[]},filter);
 assert.equal(paid.summary.revenueSatang,waiting.summary.revenueSatang);
 assert.equal(paid.summary.paidCodSatang,10000);assert.equal(paid.waitingCodCount,0);assert.equal(waiting.waitingCodSatang,10000);
});

test('booked sales filters source totals and unknown amounts remain explicit',()=>{
 const customer={code:'NEW',legacy:false,referrerId:'referrer',referrer:{name:'Referral',code:'REF'},metaFbc:null};
 const report=analyzeBookedSales(data([order('known',{customer}),order('unknown',{rawText:null}),order('other',{sellerUsername:'other'})]),{...filter,seller:'seller'});
 assert.equal(report.summary.count,2);assert.equal(report.summary.unknownAmountCount,1);assert.equal(report.summary.revenueSatang,10000);
 assert.equal(report.sources[0].name,'Referral · REF');assert.equal(report.sources[0].revenueSatang,10000);
 assert.equal(analyzeBookedSales(data([order('a',{payment:'COD'}),order('b')]),{...filter,payment:'COD'}).summary.count,1);
});

test('booked sales export includes orders without tracking and escapes spreadsheet formulas',()=>{
 const report=analyzeBookedSales(data([order('new',{sellerUsername:'=SUM(1,2)'})]),filter);
 const csv=bookedSalesCsv(report);assert.ok(csv.includes('ORDER-new'));assert.ok(csv.includes('รอจัดส่ง'));assert.ok(csv.includes('วันที่รับออเดอร์'));
 assert.ok(csv.includes("'=SUM(1,2)"));assert.ok(csv.includes('100.00'));
});
