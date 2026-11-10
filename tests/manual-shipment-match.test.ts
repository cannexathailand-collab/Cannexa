import {test} from 'node:test';
import assert from 'node:assert/strict';
import {manualShipmentMatches,assignManualShipmentOrders,previewManualShipments} from '../src/lib/manual-shipments';
import {db} from '../src/lib/db';

test('manual preview refuses a known parcel report that predates the order',async t=>{
 const original={orders:db.orderIntake.findMany,shipments:db.shipment.findMany,audit:db.auditLog.findMany};
 t.after(()=>{db.orderIntake.findMany=original.orders;db.shipment.findMany=original.shipments;db.auditLog.findMany=original.audit;});
 db.orderIntake.findMany=(async()=>[{id:'new',orderNumber:'NEW',recipient:'Customer',phone:'0812345678',payment:'COD',eventAt:new Date('2026-11-10'),rawText:'ยอดรวม: 100',address:'address',status:'WAITING_SHIPMENT',affiliateId:'seller'}]) as any;
 db.shipment.findMany=(async()=>[{tracking:'OLDTRACK',orderId:null,reportAt:new Date('2026-11-01')}]) as any;
 db.auditLog.findMany=(async()=>[]) as any;
 const [result]=await previewManualShipments([{tracking:'OLDTRACK',phone:'0812345678',recipient:'Customer',amountSatang:10000}]);
 assert.equal(result.selectedOrderId,null);assert.equal(result.candidates.length,0);assert.match(result.matchMessage,/ก่อนวันที่รับออเดอร์/);
});

test('manual matching uses telephone and sale total regardless of recipient spelling',()=>{
 const row={phone:'+66 81 234 5678',amountSatang:105000,recipient:'New name'};
 const order={phone:'0812345678',rawText:'ยอดสินค้า: 1000\nค่าส่ง: 50\nยอดรวม: 1050',recipient:'Old name'};
 assert.equal(manualShipmentMatches(row,order),true);
 assert.equal(manualShipmentMatches({...row,amountSatang:5000},order),false);
 assert.equal(manualShipmentMatches({...row,phone:'0898765432'},order),false);
 assert.equal(manualShipmentMatches({...row,amountSatang:undefined},order),false);
});
test('duplicate phone and total assign each oldest candidate only once',()=>{
 const candidates=[{id:'oldest',addressMatches:true},{id:'second',addressMatches:true}];
 const rows=assignManualShipmentOrders([1,2,3].map(()=>({existingOrderId:null,candidates})));
 assert.deepEqual(rows.map(row=>row.selectedOrderId),['oldest','second',null]);
 assert.equal(assignManualShipmentOrders([{existingOrderId:'oldest',candidates}])[0].selectedOrderId,null);
});
test('shared telephone and total use the matching delivery address before FIFO',()=>{
 const candidates=[{id:'older-other-address',addressMatches:false},{id:'matching-address',addressMatches:true}];
 assert.equal(assignManualShipmentOrders([{existingOrderId:null,candidates}])[0].selectedOrderId,'matching-address');
 assert.equal(assignManualShipmentOrders([{existingOrderId:null,candidates:candidates.map(row=>({...row,addressMatches:false}))}])[0].selectedOrderId,null);
});
test('sale total distinguishes orders sharing a telephone and rejects ambiguous totals',()=>{
 const row={phone:'0812345678',amountSatang:10000};
 const orders=[{phone:row.phone,rawText:'ยอดรวม: 100'},{phone:row.phone,rawText:'ยอดรวม: 200'},{phone:row.phone,rawText:'ยอดรวม: 100\nCOD: 100'}];
 assert.deepEqual(orders.filter(order=>manualShipmentMatches(row,order)),[orders[0]]);
});
