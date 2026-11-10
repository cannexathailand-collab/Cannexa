import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeBookedSales} from '../src/lib/booked-sales';
import {bookedSalesCsv} from '../src/lib/booked-sales-csv';

const order=(id:string,patch:Record<string,unknown>={})=>({id,orderNumber:'ORDER-'+id,eventAt:new Date('2026-11-09T09:00:00+07:00'),rawText:'ยอดรวม: 100.00',status:'WAITING_SHIPMENT',payment:'โอน',sellerUsername:'seller',affiliateId:'affiliate',recipient:'Customer',customer:null,...patch});
const data=(orders:ReturnType<typeof order>[])=>({orders,sales:[],shipments:[],receipts:[],affiliates:[]});
const filter={from:'2026-11-09',to:'2026-11-09'};

test('sales dashboard counts saved unshipped orders in their closing round',()=>{
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

test('orders across midnight share the same noon closing round',()=>{
 const report=analyzeBookedSales(data([order('late',{eventAt:new Date('2026-11-09T23:59:59+07:00')}),order('next',{eventAt:new Date('2026-11-10T00:00:00+07:00')})]),{from:'2026-11-10',to:'2026-11-10'});
 assert.deepEqual(report.orderRows.map(row=>row.id).sort(),['late','next']);
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

test('shipping display groups use linked tracking numbers and reconcile totals',()=>{
 const dataset={...data([order('new'),order('labeled'),order('sent')]),shipments:[
  {orderId:'labeled',tracking:'LABEL',status:'MATCHED',fulfillmentStatus:'UNCONFIRMED',dispatchedAt:null},
  {orderId:'sent',tracking:'SENT',status:'MATCHED',fulfillmentStatus:'DISPATCHED',dispatchedAt:new Date()},
 ]};
 const report=analyzeBookedSales(dataset,{...filter,detail:'WAITING'});
 assert.equal(report.awaitingShipment.count,1);
 assert.equal(report.shipped.count,2);
 assert.equal(report.awaitingShipment.revenueSatang+report.shipped.revenueSatang,report.summary.revenueSatang);
 assert.deepEqual(report.detailRows.map(row=>row.id).sort(),['new']);
 assert.deepEqual(analyzeBookedSales(dataset,{...filter,detail:'SHIPPED'}).detailRows.map(row=>row.id).sort(),['labeled','sent']);
 assert.ok(report.availableDays.includes(filter.from));
});

test('pending website orders are separate and disappear from the new group once linked or approved',()=>{
 const pending={id:'web',orderNumber:'WEB-1',createdAt:new Date('2026-11-09T09:00:00+07:00'),totalSatang:10000,recipient:'Customer',customerCode:'C1',paymentMethod:'COD',status:'PENDING_REVIEW',intakeOrderId:null};
 const base={...data([order('accepted')]),websiteOrders:[pending]};
 const report=analyzeBookedSales(base,{...filter,detail:'WEB_PENDING'});
 assert.equal(report.webPending.count,1);assert.equal(report.webPending.revenueSatang,10000);
 assert.equal(report.summary.count,1);assert.equal(report.summary.revenueSatang,10000);
 assert.equal(analyzeBookedSales({...base,websiteOrders:[{...pending,status:'APPROVED',intakeOrderId:'accepted'}]},filter).webPending.count,0);
 assert.equal(analyzeBookedSales({...base,websiteOrders:[{...pending,intakeOrderId:'accepted'}]},filter).webPending.count,0);
 assert.equal(analyzeBookedSales(base,{...filter,payment:'TRANSFER'}).webPending.count,0);
 assert.equal(analyzeBookedSales(base,{...filter,seller:'seller'}).webPending.count,0);
});

test('exact cutoff moves to the following round and current-round default follows settings',()=>{
 const dataset=data([order('before',{eventAt:new Date('2026-11-09T14:29:59+07:00')}),order('cutoff',{eventAt:new Date('2026-11-09T14:30:00+07:00')})]);
 const now=new Date('2026-11-09T15:00:00+07:00');
 const previous=analyzeBookedSales(dataset,filter,now,870);
 assert.deepEqual(previous.orderRows.map(row=>row.id),['before']);
 const current=analyzeBookedSales(dataset,{},now,870);
 assert.equal(current.range.from,'2026-11-10');assert.equal(current.range.to,'2026-11-10');
 assert.deepEqual(current.orderRows.map(row=>row.id),['cutoff']);
 assert.equal(current.closeTime,'14:30');
 assert.equal(current.roundStart.toISOString(),'2026-11-09T07:30:00.000Z');
 assert.equal(current.roundEnd.toISOString(),'2026-11-10T07:30:00.000Z');
});

test('current round month includes the open round beyond the calendar day',()=>{
 const now=new Date('2026-11-09T15:00:00+07:00');
 const report=analyzeBookedSales(data([order('afternoon',{eventAt:now})]),{month:'2026-11'},now,720);
 assert.equal(report.range.to,'2026-11-10');
 assert.equal(report.summary.count,1);
});

test('today sales show the live current round without a separate midnight cutoff',()=>{
 const now=new Date('2026-11-09T15:00:00+07:00');
 const dataset=data([order('morning'),order('afternoon',{eventAt:new Date('2026-11-09T14:00:00+07:00')}),order('yesterday',{eventAt:new Date('2026-11-08T23:00:00+07:00')}),order('future',{eventAt:new Date('2026-11-09T16:00:00+07:00')})]);
 const report=analyzeBookedSales(dataset,{detail:'TODAY'},now);
 assert.equal(report.today,'2026-11-10');assert.equal(report.todaySummary.count,1);assert.equal(report.todaySummary.revenueSatang,10000);
 assert.deepEqual(report.detailRows.map(row=>row.id),['afternoon']);
 assert.equal(analyzeBookedSales(dataset,{payment:'COD'},now).todaySummary.count,0);
});

test('live round profit uses posted costs instead of estimates and flags missing cost',()=>{
 const now=new Date('2026-11-09T10:00:00+07:00');
 const dataset={...data([order('known')]),recordedCosts:[{orderId:'known',costSatang:4000}]};
 const report=analyzeBookedSales(dataset,{},now);
 assert.equal(report.todaySummary.profitSatang,6000);assert.equal(report.todaySummary.estimatedCostCount,0);
 assert.equal(analyzeBookedSales(data([order('missing')]),{},now).todaySummary.profitSatang,null);
});

test('current round profit includes transfer and unpaid COD',()=>{
 const now=new Date('2026-11-09T10:00:00+07:00');
 const report=analyzeBookedSales({...data([order('transfer'),order('cod',{payment:'COD'})]),recordedCosts:[{orderId:'transfer',costSatang:3000},{orderId:'cod',costSatang:4000}]},{},now);
 assert.equal(report.todaySummary.revenueSatang,20000);assert.equal(report.todaySummary.profitSatang,13000);assert.equal(report.todaySummary.paidCodCount,0);
});

test('daily profit history covers past rounds independently of the selected day and reconciles to each round',()=>{
 const now=new Date('2026-11-10T10:00:00+07:00');
 const orders=[order('old',{eventAt:new Date('2026-10-02T08:00:00+07:00')}),order('a',{eventAt:new Date('2026-11-08T08:00:00+07:00')}),order('b',{eventAt:new Date('2026-11-08T09:00:00+07:00'),payment:'COD'}),order('missing',{eventAt:new Date('2026-11-09T08:00:00+07:00')})];
 const dataset={...data(orders),recordedCosts:[{orderId:'old',costSatang:2500},{orderId:'a',costSatang:3000},{orderId:'b',costSatang:4000}]};
 const report=analyzeBookedSales(dataset,{from:'2026-11-10',to:'2026-11-10'},now);
 assert.deepEqual(report.profitHistory.map(row=>row.day),['2026-11-10','2026-11-09','2026-11-08','2026-10-02']);
 assert.equal(report.profitHistory[0].isOpen,true);
 assert.equal(report.profitHistory.find(row=>row.day==='2026-11-08')!.profitSatang,13000);
 assert.equal(report.profitHistory.find(row=>row.day==='2026-11-09')!.profitSatang,null);
 for(const row of report.profitHistory){const detail=analyzeBookedSales(dataset,{from:row.day,to:row.day},now);assert.equal(row.revenueSatang,detail.summary.revenueSatang);assert.equal(row.costSatang,detail.summary.costSatang);assert.equal(row.profitSatang,detail.summary.profitSatang);}
 const revised=analyzeBookedSales({...dataset,recordedCosts:[...dataset.recordedCosts,{orderId:'missing',costSatang:2000}]},{},now);
 assert.equal(revised.profitHistory.find(row=>row.day==='2026-11-09')!.profitSatang,8000);
});
