import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {processAdditionalCommissions} from '../src/lib/additional-commission';

test('legacy unpaid profit commission migrates once, without freight or changing paid amounts',async t=>{
 const original={transaction:db.$transaction,sales:db.salesOrder.findMany,extra:db.additionalCommission.findMany};
 t.after(()=>{db.$transaction=original.transaction;db.salesOrder.findMany=original.sales;db.additionalCommission.findMany=original.extra;});
 const sale={id:'pending',orderId:'order',affiliateId:'seller',commissionBasis:'GROSS_PROFIT',status:'PENDING',commissionSatang:3600,commissionBps:1000,revenueSatang:100000,recognizedAt:new Date(),commissionReadyAt:null};
 let updates=0,audits=0;
 db.salesOrder.findMany=(async()=>sale.commissionBasis==='GROSS_PROFIT'?[sale]:[]) as any;
 db.additionalCommission.findMany=(async()=>[]) as any;
 db.$transaction=(async(fn:any)=>fn({
  $queryRawUnsafe:async()=>[],
  salesOrder:{findUniqueOrThrow:async()=>({...sale}),update:async({data}:any)=>{Object.assign(sale,data);updates++;return sale;}},
  stockDispatch:{findUnique:async()=>({status:'POSTED',totalCostSatang:60000})},
  orderIntake:{findUnique:async()=>({status:'TRANSFER_RECORDED'})},
  shipment:{findUnique:async()=>{throw Error('Freight must not be queried');}},
  auditLog:{create:async()=>{audits++;}},
 })) as any;
 await processAdditionalCommissions();await processAdditionalCommissions();
 assert.equal(sale.commissionSatang,4000);assert.equal(sale.commissionBasis,'PROFIT');assert.equal(updates,1);assert.equal(audits,1);
 sale.commissionBasis='GROSS_PROFIT';sale.status='PAID';sale.commissionSatang=3600;
 await processAdditionalCommissions();assert.equal(sale.commissionSatang,3600);assert.equal(updates,1);
});
