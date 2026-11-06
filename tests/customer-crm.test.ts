import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {OrderIntake} from '@prisma/client';
import {demoSalesRows} from '../src/lib/sales-demo';
import {summarizeCustomerOrders,customerLifetimeStats,crmBehaviorTags} from '../src/lib/customer-crm';

test('CRM counts each order once and separates completed purchases from pending COD and returns',()=>{
 const [transfer,cod]=demoSalesRows(new Date('2026-11-07T12:00:00+07:00'));
 const orders=[transfer,cod].map(s=>({...s.order,customerCode:'CUS-00000001',rawText:'ยอดรวม: '+s.revenueSatang/100,eventAt:s.createdAt,withdrawnAt:null}) as OrderIntake);
 const ready=summarizeCustomerOrders([...orders,orders[0]],[transfer,cod]);
 assert.equal(ready.orderCount,2);assert.equal(ready.purchaseCount,2);assert.equal(ready.purchasedSatang,150000);assert.equal(ready.orderedSatang,150000);
 assert.ok(crmBehaviorTags(ready).includes('ซื้อซ้ำ'));
 const pending=summarizeCustomerOrders(orders,[transfer,{...cod,recognizedAt:null,status:'WAITING_COD',receipt:null}]);
 assert.equal(pending.purchasedSatang,100000);assert.equal(pending.pendingSatang,50000);assert.equal(pending.pendingCount,1);
 assert.ok(crmBehaviorTags(pending).includes('ซื้อครั้งแรก'));assert.ok(crmBehaviorTags(pending).includes('มีออเดอร์รอดำเนินการ'));
 const returned=summarizeCustomerOrders([orders[0],{...orders[1],status:'RETURNED'}],[transfer,cod]);
 assert.equal(returned.orderCount,1);assert.equal(returned.purchasedSatang,100000);assert.equal(returned.history.length,2);
});

test('CRM profit requires actual product cost and freight, preserves losses and groups selected dates',()=>{
 const sale=demoSalesRows(new Date('2026-11-07T12:00:00+07:00'))[0];
 const order={...sale.order,eventAt:sale.createdAt,withdrawnAt:null} as OrderIntake;
 const shipment={...sale.shipment!,freightSatang:5000,freightReportAt:new Date()};
 const costs=[{orderId:order.id,status:'POSTED',totalCostSatang:110000}];
 const rules=[{enabled:true,satangPerPoint:10000,effectiveAt:new Date('2026-11-01')}];
 const full=summarizeCustomerOrders([order],[sale],[shipment],costs,rules,{from:'2026-11-01',to:'2026-11-30',view:'month'});
 assert.equal(full.profitSatang,-15000);assert.equal(full.points,10);assert.equal(full.periods[0].period,'2026-11');
 assert.equal(summarizeCustomerOrders([order],[sale],[shipment],[],rules).pendingCostCount,1);
 const filtered=summarizeCustomerOrders([order],[sale],[shipment],costs,rules,{from:'2026-10-01',to:'2026-10-31'});
 assert.equal(filtered.purchaseCount,0);assert.equal(filtered.lifetimePoints,10);
});

test('lifetime averages include inactive months and do not invent repeat-purchase frequency',()=>{
 const first=demoSalesRows(new Date('2026-09-01T12:00:00+07:00'))[0],second=demoSalesRows(new Date('2026-11-01T12:00:00+07:00'))[0];second.id='second';second.orderId='second';second.order={...second.order!,id:'second'};second.shipment={...second.shipment!,orderId:'second'};
 const orders=[first,second].map(s=>({...s.order,eventAt:s.createdAt,withdrawnAt:null}) as OrderIntake);
 const summary=summarizeCustomerOrders(orders,[first,second]);
 const life=customerLifetimeStats(summary,new Date('2026-11-05'),new Date('2026-11-07'));
 assert.equal(life.months,3);assert.equal(life.monthlyAverageSatang,66667);assert.equal(life.averageGapDays,61);assert.equal(life.days,67);
 assert.equal(life.currentMonthPurchases,1);assert.equal(life.currentMonthSpentSatang,100000);assert.equal(life.currentMonthProfitSatang,null);
 assert.equal(customerLifetimeStats(summarizeCustomerOrders([orders[0]],[first]),new Date('2026-09-01')).averageGapDays,null);
});

test('CRM keeps unpriced, cancelled and claim history without inventing purchase amounts',()=>{
 const base={id:'new',orderNumber:'new',customerCode:'CUS-00000001',payment:'โอน',rawText:'สินค้า A',status:'WAITING_SHIPMENT',eventAt:new Date('2026-11-07T06:00Z'),withdrawnAt:null} as OrderIntake;
 const result=summarizeCustomerOrders([base,{...base,id:'cancel',status:'CANCELLED'},{...base,id:'claim',payment:'เคลม'},{...base,id:'withdraw',withdrawnAt:new Date()}],[]);
 assert.equal(result.orderCount,1);assert.equal(result.unknownAmountCount,1);assert.equal(result.orderedSatang,0);assert.equal(result.purchaseCount,0);assert.equal(result.history.length,4);
 assert.equal(result.lastOrderedAt,base.eventAt);
 assert.equal(summarizeCustomerOrders([],[]).lastOrderedAt,null);
});

test('CRM rejects stale recognition when dispatched COD does not have a matching receipt',()=>{
 const cod=demoSalesRows()[1],order={...cod.order,rawText:'COD: 500',eventAt:cod.createdAt,withdrawnAt:null} as OrderIntake;
 const result=summarizeCustomerOrders([order],[{...cod,receipt:{...cod.receipt!,amountSatang:40000}}]);
 assert.equal(result.purchaseCount,0);assert.equal(result.pendingSatang,50000);
});

test('not-accepted count includes only returned orders, once each, and supports date ranges',()=>{
 const base={id:'return',orderNumber:'return',payment:'COD',rawText:'COD: 500',status:'RETURNED',eventAt:new Date('2026-11-05T06:00Z'),withdrawnAt:null} as OrderIntake;
 const cancelled={...base,id:'cancel',status:'CANCELLED'},withdrawn={...base,id:'withdraw',status:'WITHDRAWN'},pending={...base,id:'pending',status:'WAITING_SHIPMENT'};
 const result=summarizeCustomerOrders([base,base,cancelled,withdrawn,pending],[]);
 assert.equal(result.returnedCount,1);assert.equal(result.lifetimeReturnedCount,1);assert.equal(result.history.find(h=>h.order.id==='return')!.status,'ไม่รับสินค้า · ตีกลับ');
 assert.equal(result.shippedCount,1);assert.equal(result.returnPercent,100);
 const filtered=summarizeCustomerOrders([base],[],[],[],[],{from:'2026-11-06',to:'2026-11-07'});
 assert.equal(filtered.returnedCount,0);assert.equal(filtered.lifetimeReturnedCount,1);
 assert.equal(filtered.returnPercent,null);assert.equal(filtered.lifetimeReturnPercent,100);
 const shipment={orderId:'pending',status:'RETURNED',fulfillmentStatus:'RETURNED'} as any;
 assert.equal(summarizeCustomerOrders([pending],[],[shipment]).returnedCount,1);
 const sent={orderId:'pending',status:'MATCHED',fulfillmentStatus:'DISPATCHED',dispatchedAt:new Date()} as any;
 const half=summarizeCustomerOrders([base,pending,cancelled,withdrawn],[],[sent]);
 assert.equal(half.shippedCount,2);assert.equal(half.returnPercent,50);
 assert.equal(summarizeCustomerOrders([{...base,payment:'เคลม'}],[]).returnedCount,0);
});
