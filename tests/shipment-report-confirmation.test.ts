import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {shipmentReportEvidence,confirmReportedShipment} from '../src/lib/shipment-report-confirmation';
const at=new Date('2026-11-06T12:00Z'),activeFrom=new Date('2026-11-01');
function fixture(){
 const order:any={id:'order',messageKey:'message',orderNumber:'ORDER',affiliateId:'seller',createdAt:new Date('2026-11-05'),eventAt:new Date('2026-11-05'),payment:'โอน',status:'TRANSFER_RECORDED',rawText:'ยอดรวม: 100 บาท',salesCommissionBasis:'REVENUE',salesCommissionBps:200};
 const shipment:any={orderId:'order',tracking:'TRACK1',importId:'report',status:'MATCHED_TRANSFER',fulfillmentStatus:'UNCONFIRMED',dispatchedAt:null,reportAt:at,codSatang:0};
 const report:any={id:'report',kind:'SHIPMENT',filename:'freight.xlsx',messageId:'email',rowCount:1,reportAt:at};
 return {order,shipment,report};
}
test('matched shipment report is automatic evidence with the report date, without claiming delivery to the recipient',()=>{
 const h=fixture(),evidence=shipmentReportEvidence(h.order,h.shipment,h.report,activeFrom,true,at);
 assert.equal(evidence?.dispatchedAt,at);assert.equal(evidence?.dispatchConfirmedBy,'shipment-report');assert.match(evidence!.dispatchEvidence,/ไม่ใช่วันที่ผู้รับได้รับพัสดุ/);
 for(const payment of ['COD','เคลม']){h.order.payment=payment;assert.ok(shipmentReportEvidence(h.order,h.shipment,h.report,activeFrom,true,at));}
});
test('missing, ambiguous, failed, returned and cancelled shipments never confirm; duplicate and unrelated reports cannot confirm',()=>{
 for(const status of ['WAITING_ORDER','AMBIGUOUS_ORDER','MATCHED_COD_AMOUNT_MISMATCH','RETURNED','CANCELLED','FAILED']){const h=fixture();h.shipment.status=status;assert.equal(shipmentReportEvidence(h.order,h.shipment,h.report,activeFrom,true,at),null);}
 for(const state of ['PENDING','FAILED','RETURNED','CANCELLED','DISPATCHED']){const h=fixture();h.shipment.fulfillmentStatus=state;assert.equal(shipmentReportEvidence(h.order,h.shipment,h.report,activeFrom,true,at),null);}
 for(const status of ['CANCELLED','WITHDRAWN','RETURNED','EXPIRED','NEEDS_REVIEW']){const h=fixture();h.order.status=status;assert.equal(shipmentReportEvidence(h.order,h.shipment,h.report,activeFrom,true,at),null);}
 const h=fixture();assert.equal(shipmentReportEvidence(h.order,h.shipment,null,activeFrom,true,at),null);
 assert.equal(shipmentReportEvidence(h.order,h.shipment,{...h.report,id:'other'},activeFrom,true,at),null);
 assert.equal(shipmentReportEvidence(h.order,h.shipment,{...h.report,kind:'COD'},activeFrom,true,at),null);
 assert.equal(shipmentReportEvidence(h.order,h.shipment,{...h.report,rowCount:0},activeFrom,true,at),null);
 assert.equal(shipmentReportEvidence(h.order,h.shipment,h.report,new Date('2026-11-07'),true,at),null);
 assert.equal(shipmentReportEvidence({...h.order,eventAt:new Date('2026-11-07')},h.shipment,h.report,activeFrom,true,at),null);
});
test('automatic confirmation and sales recognition are idempotent, COD still waits for payment',async t=>{
 const h=fixture();let sale:any=null;const audit=new Map<string,unknown>();let writes=0;
 const tx:any={$queryRawUnsafe:async()=>[],stockIntegrationConfig:{findUnique:async()=>({enabled:true,activeFrom})},stockReservation:{findUnique:async()=>({status:'RESERVED',needsReconciliation:false})},orderIntake:{findUnique:async()=>h.order},shipment:{findUnique:async()=>h.shipment,update:async({data}:any)=>{writes++;return Object.assign(h.shipment,data);}},gmailImport:{findUnique:async()=>h.report},salesOrder:{findUnique:async()=>sale,create:async({data}:any)=>sale={id:'sale',...data},update:async({data}:any)=>sale={...sale,...data}},codReceipt:{findUnique:async()=>null},auditLog:{create:async()=>{},upsert:async({where,create}:any)=>{if(!audit.has(where.id))audit.set(where.id,create);}}};
 const original=db.$transaction;t.after(()=>{db.$transaction=original;});db.$transaction=(async(fn:any)=>fn(tx)) as any;
 assert.equal(await confirmReportedShipment('order','test'),true);assert.equal(writes,1);assert.equal(+sale.recognizedAt,+at);assert.equal(audit.size,1);
 assert.equal(await confirmReportedShipment('order','test'),false);assert.equal(writes,1);assert.equal(audit.size,1);
 Object.assign(h.shipment,{fulfillmentStatus:'UNCONFIRMED',dispatchedAt:null,status:'MATCHED_WAITING_COD',codSatang:10000});h.order.payment='COD';sale=null;
 assert.equal(await confirmReportedShipment('order','test'),true);assert.equal(sale.status,'WAITING_COD');assert.equal(sale.recognizedAt,null);
});
test('a matched report that cannot recognize its seller leaves a detailed stock review record',async t=>{
 const h=fixture();h.order.affiliateId=null;let review:any=null;
 const tx:any={$queryRawUnsafe:async()=>[],stockIntegrationConfig:{findUnique:async()=>({enabled:true,activeFrom})},stockReservation:{findUnique:async()=>({status:'RESERVED',needsReconciliation:false})},orderIntake:{findUnique:async()=>h.order},shipment:{findUnique:async()=>h.shipment,update:async({data}:any)=>({...h.shipment,...data})},gmailImport:{findUnique:async()=>h.report},salesOrder:{findUnique:async()=>null}};
 const original=db.$transaction,upsert=db.stockDispatch.upsert,update=db.stockDispatch.updateMany;
 t.after(()=>{db.$transaction=original;db.stockDispatch.upsert=upsert;db.stockDispatch.updateMany=update;});
 db.$transaction=(async(fn:any)=>fn(tx)) as any;
 db.stockDispatch.upsert=(async({create}:any)=>review=create) as any;
 db.stockDispatch.updateMany=(async({where,data}:any)=>{assert.equal(where.historySavedAt,null);assert.ok(!where.status.in.includes('POSTED'));Object.assign(review,data);return {count:1};}) as any;
 await assert.rejects(confirmReportedShipment('order','test'),/SELLER_NOT_READY/);
 assert.equal(review.status,'NEEDS_REVIEW');assert.equal(review.orderId,h.order.id);assert.equal(review.candidateTracking,h.shipment.tracking);assert.match(review.issues[0],/ข้อมูลผู้ขาย/);
 assert.equal(h.shipment.fulfillmentStatus,'UNCONFIRMED');
});
