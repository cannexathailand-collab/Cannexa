import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executivePeriodSummary} from '../src/lib/executive-metrics';
import type {BookedSale} from '../src/lib/booked-sales';
import type {SaleRow} from '../src/lib/sales-report';
const at=new Date('2026-11-10T04:00:00Z'),start=new Date('2026-11-09T05:00:00Z'),end=new Date('2026-11-10T05:00:00Z');
const booked=(id:string,change:Partial<BookedSale>={})=>({id,eventAt:at,revenueSatang:10000,customer:{code:'C1'},sellerUsername:'staff',paymentMethod:'TRANSFER',hasTracking:true,codPaid:false,...change}) as BookedSale;
const sale=(id:string,change:Partial<SaleRow>={})=>({id,orderId:id,revenueSatang:10000,status:'PENDING',paymentMethod:'TRANSFER',recognizedAt:at,tracking:'TRACK-'+id,order:{id,orderNumber:id,payment:'โอน',status:'TRANSFER_RECORDED'},shipment:{tracking:'TRACK-'+id,orderId:id,fulfillmentStatus:'DISPATCHED',status:'MATCHED_TRANSFER',dispatchedAt:at,dispatchEvidence:'Receipt',freightSatang:1000,freightReportAt:at},...change}) as SaleRow;
test('executive summary separates demand and completed profit and counts buyers distinctly',()=>{
 const result=executivePeriodSummary([booked('1'),booked('2',{paymentMethod:'COD',hasTracking:false})],[sale('1')],[{orderId:'1',status:'POSTED',totalCostSatang:6000}],start,end);
 assert.equal(result.orderedSatang,20000);assert.equal(result.completedSatang,10000);assert.equal(result.profitSatang,4000);
 assert.equal(result.buyers,1);assert.equal(result.repeatBuyers,1);assert.equal(result.waitingShipment,1);assert.equal(result.waitingCod,1);
 assert.equal(result.sellers[0].amountSatang,20000);
});
test('missing freight does not create a pending product profit',()=>{
 const row=sale('1');row.shipment!.freightSatang=null;
 const result=executivePeriodSummary([booked('1')],[row],[{orderId:'1',status:'POSTED',totalCostSatang:6000}],start,end);
 assert.equal(result.profitSatang,4000);assert.equal(result.missingProductCosts,0);assert.equal(result.missingProfit,0);assert.equal(result.pendingProfitOrders.length,0);
});
test('round end is exclusive and unconfirmed sales are excluded',()=>{
 const excluded=sale('unconfirmed');excluded.recognizedAt=null;
 const result=executivePeriodSummary([booked('outside',{eventAt:end})],[excluded],[],start,end);
 assert.equal(result.orderCount,0);assert.equal(result.completedCount,0);assert.equal(result.profitSatang,0);
});

test('late freight reports do not change profit after product costs',()=>{
 const row=sale('late');row.shipment!.freightSatang=null;row.shipment!.freightReportAt=null;
 const costs=[{orderId:'late',status:'POSTED',totalCostSatang:6000}];
 const before=executivePeriodSummary([booked('late')],[row],costs,start,end);
 row.shipment!.freightSatang=1500;row.shipment!.freightReportAt=at;
 const after=executivePeriodSummary([booked('late')],[row],costs,start,end);
 assert.equal(before.profitSatang,4000);assert.equal(after.profitSatang,4000);
 assert.equal(after.missingProfit,0);
});

test('missing product cost remains unknown',()=>{
 const result=executivePeriodSummary([booked('missing')],[sale('missing')],[],start,end);
 assert.equal(result.profitSatang,null);assert.equal(result.missingProductCosts,1);
});

test('selected order round keeps later dispatch and collection in the same order set',()=>{
 const row=sale('later');const later=new Date(+end+2*86400000);row.recognizedAt=later;row.shipment!.dispatchedAt=later;
 const result=executivePeriodSummary([booked('later')],[row],[{orderId:'later',status:'POSTED',totalCostSatang:6000}],start,end);
 assert.equal(result.orderCount,1);assert.equal(result.completedCount,1);assert.equal(result.completedSatang,10000);assert.equal(result.profitSatang,4000);
});

test('a sale dispatched in the selected period is excluded when its order belongs to another round',()=>{
 const result=executivePeriodSummary([booked('older',{eventAt:new Date(+start-1)})],[sale('older')],[{orderId:'older',status:'POSTED',totalCostSatang:6000}],start,end);
 assert.equal(result.orderCount,0);assert.equal(result.completedCount,0);assert.equal(result.profitSatang,0);
});
