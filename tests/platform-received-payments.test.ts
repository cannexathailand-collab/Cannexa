import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {PrismaClient} from '@prisma/client';
import {platformCustomerData} from '../src/lib/platform-customer-data';

function clientFixture(withCosts=true){
 const createdAt=new Date('2026-11-01T00:00:00Z');
 const orders=[{id:'transfer',payment:'โอน'},{id:'cod',payment:'COD'}].map(order=>({...order,customerCode:'C0001',status:'WAITING_SHIPMENT',eventAt:createdAt,createdAt,rawText:null,withdrawnAt:null,loyaltySnapshot:null}));
 const sales=orders.map(order=>({id:order.id,orderId:order.id,revenueSatang:order.id==='transfer'?10000:20000,status:'WAITING_COD',recognizedAt:null,tracking:null,paymentMethod:order.id==='cod'?'COD':'TRANSFER'}));
 const client={
  websiteOrder:{findMany:async()=>[]},
  customer:{findMany:async()=>[{code:'C0001',name:'Test',phone:null,address:null,createdAt}]},
  orderIntake:{findMany:async()=>orders},salesOrder:{findMany:async()=>sales},shipment:{findMany:async()=>[]},
  stockDispatch:{findMany:async()=>withCosts?[{orderId:'transfer',status:'POSTED',totalCostSatang:6000},{orderId:'cod',status:'POSTED',totalCostSatang:7000}]:[]},
  crmPointRule:{findMany:async()=>[]},crmRewardRedemption:{groupBy:async()=>[]},
  stockSheetsConnection:{findUnique:async()=>null},
 } as unknown as PrismaClient;
 return {client,sales};
}
test('recorded bank transfers are received before dispatch while COD remains pending',async()=>{
 const {client,sales}=clientFixture();
 const [row]=await platformCustomerData(client);
 assert.equal(row.orderedSatang,30000);assert.equal(row.purchasedSatang,10000);
 assert.equal(row.pendingSatang,20000);assert.equal(row.profitSatang,4000);
 assert.equal(row.pendingCod.profitSatang,13000);assert.equal(row.purchaseCount,1);
 assert.equal(row.orderedSatang,row.purchasedSatang+row.pendingSatang);
 assert.equal(sales[0].recognizedAt,null);
});
test('missing costs never remove received bank-transfer money or invent a profit',async()=>{
 const {client}=clientFixture(false);
 const [row]=await platformCustomerData(client);
 assert.equal(row.purchasedSatang,10000);assert.equal(row.pendingSatang,20000);
 assert.equal(row.profitSatang,null);assert.equal(row.pendingCostCount,1);
 assert.equal(row.pendingCod.profitSatang,null);
});
