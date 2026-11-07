import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attributeMarketingSales,marketingWindowDays} from '../src/lib/marketing-report';
import type {SaleRow} from '../src/lib/sales-report';

const clickedAt=new Date('2026-11-01T01:00:00Z');
const enteredAt=new Date('2026-11-01T01:05:00Z');
const dispatchedAt=new Date('2026-11-07T01:00:00Z');
const touch={id:'click-one',marketingCustomerCode:'CUS-00000001',createdAt:clickedAt,customerLanding:true,customerEnteredAt:enteredAt};
const order={id:'order-one',orderNumber:'ORDER-ONE',customerCode:'CUS-00000001',eventAt:new Date('2026-11-02T01:00:00Z')};

function sale(id='order-one'):SaleRow{
 return {
  id,orderId:id,affiliateId:'seller',paymentMethod:'TRANSFER',status:'PENDING',revenueSatang:10000,commissionSatang:0,
  tracking:'TRACK-'+id,recognizedAt:dispatchedAt,
  order:{id,orderNumber:id,sellerUsername:'seller',sellerCode:'seller',payment:'โอน',status:'MATCHED_SHIPMENT'},
  shipment:{tracking:'TRACK-'+id,orderId:id,fulfillmentStatus:'DISPATCHED',dispatchedAt,status:'MATCHED_TRANSFER',codSatang:0},
  receipt:null,
 } as SaleRow;
}

test('marketing attributes an order once to its latest admitted eligible touch',()=>{
 const recent={...touch,id:'click-two',createdAt:new Date('2026-11-01T02:00:00Z'),customerEnteredAt:new Date('2026-11-01T02:05:00Z')};
 const rows=attributeMarketingSales([sale(),sale()],[order],[touch,recent,{...recent,id:'unadmitted',customerEnteredAt:null}]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].clickId,'click-two');
 assert.equal(rows[0].revenueSatang,10000);
 assert.equal(attributeMarketingSales([sale()],[{...order,customerCode:'CUS-00000002'}],[touch]).length,0);
 assert.equal(attributeMarketingSales([sale()],[order],[{...touch,customerLanding:false}]).length,0);
});

test('marketing admits orders from entry time until before the thirty-day cutoff',()=>{
 const cutoff=+clickedAt+marketingWindowDays*86400000;
 const count=(eventAt:Date)=>attributeMarketingSales([sale()],[{...order,eventAt}],[touch]).length;
 assert.equal(count(new Date(+enteredAt-1)),0);
 assert.equal(count(enteredAt),1);
 assert.equal(count(new Date(cutoff-1)),1);
 assert.equal(count(new Date(cutoff)),0);
 assert.equal(attributeMarketingSales([sale()],[order],[{...touch,customerEnteredAt:new Date(+clickedAt-1)}]).length,0);
});

test('marketing uses the existing recognized-sales rules for returns and COD receipts',()=>{
 const transfer=sale();
 const returned={...transfer,order:{...transfer.order!,status:'RETURNED'}};
 assert.equal(attributeMarketingSales([returned],[order],[touch]).length,0);
 const cod={...transfer,paymentMethod:'COD',order:{...transfer.order!,payment:'COD'},shipment:{...transfer.shipment!,codSatang:10000}};
 assert.equal(attributeMarketingSales([cod],[order],[touch]).length,0);
 assert.equal(attributeMarketingSales([{...cod,receipt:{tracking:cod.tracking!,amountSatang:9999} as SaleRow['receipt']}],[order],[touch]).length,0);
 assert.equal(attributeMarketingSales([{...cod,receipt:{tracking:cod.tracking!,amountSatang:10000} as SaleRow['receipt']}],[order],[touch]).length,1);
});
