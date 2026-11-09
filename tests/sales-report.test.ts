import {test} from "node:test";
import assert from "node:assert/strict";
import {summarizeSales,analyzeSales,salesSources,type SaleRow} from "../src/lib/sales-report";
import {bangkokDay,salesRange,shiftMonth,compareRevenue,parseDispatchTime} from "../src/lib/sales-dates";
const sent=new Date("2026-11-05T17:05:00Z");
const row=(id:string,values:Record<string,unknown>={}):SaleRow=>({id,orderId:id,affiliateId:"affiliate",paymentMethod:"TRANSFER",status:"PENDING",revenueSatang:10000,commissionSatang:200,paidAmountSatang:null,tracking:"TRACK-"+id,recognizedAt:sent,createdAt:new Date("2026-10-01"),order:{id,orderNumber:id,sellerUsername:"ink123",sellerCode:"Ink123",payment:"โอน",status:"TRANSFER_RECORDED"},affiliate:{id:"affiliate",name:"Affiliate",code:"11155"},shipment:{tracking:"TRACK-"+id,orderId:id,fulfillmentStatus:"DISPATCHED",dispatchedAt:sent,status:"MATCHED_TRANSFER",codSatang:10000,dispatchEvidence:"ใบรับฝากจริง"},receipt:null,...values}) as SaleRow;
const cod=(id:string,values:Record<string,unknown>={})=>row(id,{paymentMethod:"COD",order:{...row(id).order,payment:"COD",status:"MATCHED_SHIPMENT"},receipt:{tracking:"TRACK-"+id,amountSatang:10000,reportAt:sent},...values});
test('source totals reconcile and repeat buyers count once independently of selling staff',()=>{
 const old={code:'OLD',legacy:true,referrerId:'a',referrer:{name:'A',code:'A'},metaFbc:null};
 const fresh={...old,code:'NEW',legacy:false};
 const results=salesSources([row('1',{customer:old}),row('2',{customer:old}),row('3',{customer:fresh}),row('4',{customer:{...fresh,code:'META',metaFbc:'tracked'}})]);
 assert.equal(results.reduce((n,r)=>n+r.revenueSatang,0),40000);
 const legacy=results.find(r=>r.key==='legacy')!;assert.equal(legacy.customers,1);assert.equal(legacy.orders,2);assert.equal(legacy.revenueSatang,20000);
 assert.ok(results.some(r=>r.key==='meta'));assert.ok(results.some(r=>r.key==='affiliate:a'));
});
test("sales exclude unshipped paid transfers, tracking labels and freight reports without dispatch proof",()=>{
 for(const status of ["PENDING","PAID"]){const base=row(status,{status});assert.equal(summarizeSales([{...base,recognizedAt:null}]).count,0);assert.equal(summarizeSales([{...base,shipment:{...base.shipment!,fulfillmentStatus:"UNCONFIRMED",dispatchedAt:null}}]).count,0);}
 assert.equal(summarizeSales([row("sent")]).count,1);
});
test("COD requires actual dispatch AND matching receipt; receipt alone and amount mismatch cannot count",()=>{
 const base=cod("cod");assert.equal(summarizeSales([base]).revenueSatang,10000);
 for(const changed of [{receipt:null},{receipt:{tracking:base.tracking,amountSatang:9999}},{shipment:{...base.shipment!,dispatchedAt:null}},{recognizedAt:null}])assert.equal(summarizeSales([{...base,...changed} as SaleRow]).count,0);
});
test("cancelled returned and claim orders leave revenue even if commission was already paid",()=>{
 for(const status of ["RETURNED","CANCELLED","WITHDRAWN"]){const base=row(status,{status:"PAID"});assert.equal(summarizeSales([{...base,order:{...base.order!,status}}]).count,0);assert.equal(summarizeSales([{...base,shipment:{...base.shipment!,status}}]).count,0);}
 const base=row("claim");assert.equal(summarizeSales([{...base,order:{...base.order!,payment:"เคลม"}},{...base,order:null}]).count,0);
});
test("sales use Bangkok dispatch date, independent of order and COD receipt dates",()=>{
 const r=analyzeSales([row("t"),cod("c")],{from:"2026-11-06",to:"2026-11-06"});assert.equal(r.summary.revenueSatang,20000);assert.equal(r.daily[0].day,"2026-11-06");assert.equal(analyzeSales([row("t")],{from:"2026-11-05",to:"2026-11-05"}).summary.count,0);
});
test("shared affiliate seller accounts remain separated and range/payment filters apply to comparisons",()=>{
 const a=row("a"),b=cod("b",{order:{...cod("b").order,sellerUsername:"ploysai"}});const r=analyzeSales([a,b],{from:"2026-11-06",to:"2026-11-06"});assert.equal(r.groups.length,2);assert.equal(r.summary.transferSatang,10000);assert.equal(r.summary.codSatang,10000);
 const filtered=analyzeSales([a,b],{from:"2026-11-06",to:"2026-11-06",seller:"ploysai",payment:"COD"});assert.equal(filtered.summary.count,1);assert.equal(filtered.groups[0].name,"ploysai");assert.equal(filtered.previous[0].percent,null);
});
test("unpaid dispatched COD is displayed separately without increasing daily revenue",()=>{const r=analyzeSales([cod("wait",{status:"WAITING_COD",recognizedAt:null,receipt:null})],{from:"2026-11-06",to:"2026-11-06"});assert.equal(r.summary.count,0);assert.equal(r.waitingCodCount,1);assert.equal(r.waitingCodSatang,10000);assert.equal(r.daily[0].revenueSatang,0);});
test("daily totals and shifted comparisons reconcile including empty days",()=>{
 const a=row("today"),date=new Date(+sent-86400000),b=row("yesterday",{recognizedAt:date,shipment:{...row("yesterday").shipment,dispatchedAt:date},revenueSatang:5000});const r=analyzeSales([a,b],{from:"2026-11-06",to:"2026-11-07"});assert.equal(r.daily.reduce((n,d)=>n+d.revenueSatang,0),r.summary.revenueSatang);assert.equal(r.daily[1].count,0);assert.equal(r.previous[0].base,15000);assert.equal(r.previous[0].difference,-5000);
});
test("shipping-date correction moves the sale between calendar ranges",()=>{const a=row("a"),date=new Date("2026-10-31T16:59:00Z"),changed={...a,recognizedAt:date,shipment:{...a.shipment!,dispatchedAt:date}};assert.equal(analyzeSales([changed],{month:"2026-11"}).summary.count,0);assert.equal(analyzeSales([changed],{month:"2026-10"}).summary.count,1);});
test("Bangkok midnight, leap months and zero comparison base are explicit",()=>{assert.equal(bangkokDay(new Date("2026-11-05T17:00Z")),"2026-11-06");assert.equal(shiftMonth("2024-03-31",-1),"2024-02-29");assert.equal(shiftMonth("2026-03-31",-1),"2026-02-28");assert.equal(compareRevenue(100,0).percent,null);assert.equal(compareRevenue(150,100).percent,50);assert.throws(()=>salesRange({from:"2026-02-30",to:"2026-03-01"}));assert.throws(()=>salesRange({from:"2026-11-07",to:"2026-11-06"}));assert.equal(parseDispatchTime("2026-01-01T00:00").toISOString(),"2025-12-31T17:00:00.000Z");assert.throws(()=>parseDispatchTime("2026-02-30T12:00"));});

 test('order totals include unpaid COD while recognized sales remain separate and filters apply',()=>{
 const rows=[row('transfer'),cod('paid'),cod('waiting',{status:'WAITING_COD',recognizedAt:null,receipt:null})];
 const input={from:'2026-11-06',to:'2026-11-06'};
 const report=analyzeSales(rows,input);
 assert.deepEqual(report.orderTotals,{count:3,amountSatang:30000,transferCount:1,codCount:2,codSatang:20000,paidCodCount:1});
 assert.equal(report.orderRows.length,3);assert.equal(report.summary.count,2);assert.equal(report.summary.revenueSatang,20000);
 const transfer=analyzeSales(rows,{...input,payment:'TRANSFER'});
 assert.equal(transfer.orderTotals.count,1);assert.equal(transfer.orderTotals.codSatang,0);
 const onlyCod=analyzeSales(rows,{...input,payment:'COD'});
 assert.equal(onlyCod.orderTotals.count,2);assert.equal(onlyCod.orderTotals.amountSatang,20000);assert.equal(onlyCod.waitingCodSatang,10000);
 assert.equal(analyzeSales(rows,{...input,seller:'missing'}).orderTotals.count,0);
 assert.equal(analyzeSales(rows,{from:'2026-11-07',to:'2026-11-07'}).orderTotals.count,0);
 });
test('sales drilldowns show the selected category without changing summary filters',()=>{
 const rows=[row('transfer'),cod('paid'),cod('waiting',{status:'WAITING_COD',recognizedAt:null,receipt:null})];
 const filters={from:'2026-11-06',to:'2026-11-06'};
 for(const [detail,ids] of [['ALL',['transfer','paid','waiting']],['TRANSFER',['transfer']],['COD',['paid','waiting']],['COD_PAID',['paid']],['COD_WAITING',['waiting']],['RECOGNIZED',['transfer','paid']]] as const){const report=analyzeSales(rows,{...filters,detail});assert.deepEqual(report.detailRows.map(r=>r.id).sort(),[...ids].sort());assert.equal(report.orderTotals.count,3);}
 assert.equal(analyzeSales(rows,{...filters,detail:'invalid'}).detail,'ALL');
 assert.equal(analyzeSales(rows,{...filters,detail:'COD_WAITING',payment:'TRANSFER'}).detailRows.length,0);
});

 test('COD income follows receipt report date even when dispatch happened on another day',()=>{
 const paid=cod('paid',{receipt:{tracking:'TRACK-paid',amountSatang:10000,reportAt:new Date('2026-11-07T17:30:00Z')}});
 const sentDay=analyzeSales([row('transfer'),paid],{from:'2026-11-06',to:'2026-11-06'});
 assert.equal(sentDay.summary.count,2);assert.equal(sentDay.income.codSatang,0);assert.equal(sentDay.income.amountSatang,10000);
 const receivedDay=analyzeSales([row('transfer'),paid],{from:'2026-11-08',to:'2026-11-08',detail:'INCOME'});
 assert.equal(receivedDay.summary.count,0);assert.equal(receivedDay.income.codSatang,10000);assert.equal(receivedDay.income.rows[0].orderId,'paid');
 assert.equal(receivedDay.detail,'INCOME');
 });
 test('COD income includes unmatched email receipts once and applies seller filters',()=>{
 const receipt={tracking:'UNMATCHED',importId:'email',amountSatang:25000,reportAt:new Date('2026-11-08T03:00:00Z'),order:null};
 const filters={from:'2026-11-08',to:'2026-11-08'};
 const result=analyzeSales([],filters,new Date(),[receipt,receipt]);
 assert.equal(result.income.count,1);assert.equal(result.income.codSatang,25000);assert.equal(result.income.unmatchedCount,1);
 assert.equal(analyzeSales([],{...filters,payment:'TRANSFER'},new Date(),[receipt]).income.count,0);
 assert.equal(analyzeSales([],{...filters,seller:'ink123'},new Date(),[receipt]).income.count,0);
 });
test('a receipt waiting for an order keeps its original income date after matching',()=>{
 const receipt={tracking:'LATER',importId:'email',amountSatang:25000,reportAt:new Date('2026-11-08T03:00:00Z'),order:null};
 const filters={from:'2026-11-08',to:'2026-11-08'};
 const before=analyzeSales([],filters,new Date(),[receipt]);
 const linked={...receipt,order:{id:'later',orderNumber:'ORDER',sellerUsername:'ink123',affiliateId:'affiliate'}};
 const after=analyzeSales([],filters,new Date(),[linked]);
 assert.equal(before.income.amountSatang,after.income.amountSatang);assert.equal(before.income.unmatchedCount,1);assert.equal(after.income.unmatchedCount,0);
 assert.equal(+before.income.rows[0].date,+after.income.rows[0].date);assert.equal(after.income.rows[0].orderId,'later');
 assert.equal(analyzeSales([],{from:'2026-11-09',to:'2026-11-09'},new Date(),[linked]).income.codSatang,0);
});
