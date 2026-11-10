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
 assert.equal(result.orderedSatang,20000);assert.equal(result.completedSatang,10000);assert.equal(result.profitSatang,3000);
 assert.equal(result.buyers,1);assert.equal(result.repeatBuyers,1);assert.equal(result.waitingShipment,1);assert.equal(result.waitingCod,1);
 assert.equal(result.sellers[0].amountSatang,20000);
});
test('missing freight keeps total profit unknown and identifies affected order',()=>{
 const row=sale('1');row.shipment!.freightSatang=null;
 const result=executivePeriodSummary([booked('1')],[row],[{orderId:'1',status:'POSTED',totalCostSatang:6000}],start,end);
 assert.equal(result.profitSatang,null);assert.equal(result.missingFreight,1);assert.equal(result.missingProductCosts,0);assert.equal(result.pendingProfitOrders[0].reason,'รอค่าส่ง');
});
test('round end is exclusive and unconfirmed sales are excluded',()=>{
 const excluded=sale('unconfirmed');excluded.recognizedAt=null;
 const result=executivePeriodSummary([booked('outside',{eventAt:end})],[excluded],[],start,end);
 assert.equal(result.orderCount,0);assert.equal(result.completedCount,0);assert.equal(result.profitSatang,0);
});
