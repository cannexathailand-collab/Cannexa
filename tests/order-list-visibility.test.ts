import assert from 'node:assert/strict';import {test} from 'node:test';import {db} from '../src/lib/db';import {isCancelledOrder,visibleWebsiteOrders} from '../src/lib/order-list-visibility';
test('order visibility hides cancellations and withdrawals but preserves returns and active orders',()=>{
 assert.equal(isCancelledOrder({status:'CANCELLED'}),true);
 assert.equal(isCancelledOrder({status:'WITHDRAWN'}),true);
 assert.equal(isCancelledOrder({status:'WAITING_SHIPMENT',withdrawnAt:new Date()}),true);
 assert.equal(isCancelledOrder({status:'WAITING_SHIPMENT'},{fulfillmentStatus:'CANCELLED'}),true);
 assert.equal(isCancelledOrder({status:'RETURNED'},{fulfillmentStatus:'RETURNED'}),false);
 assert.equal(isCancelledOrder({status:'TRANSFER_RECORDED'}),false);
});
test('website lists hide rejected orders and orders cancelled after approval without deleting evidence',async context=>{
 const orderFind=db.orderIntake.findMany,shipmentFind=db.shipment.findMany;
 context.after(()=>{db.orderIntake.findMany=orderFind;db.shipment.findMany=shipmentFind;});
 db.orderIntake.findMany=(async()=>[{id:'cancelled'}]) as typeof orderFind;
 db.shipment.findMany=(async()=>[{orderId:'cancelled-shipment'}]) as typeof shipmentFind;
 const rows=[{id:'pending',status:'PENDING_REVIEW',intakeOrderId:null},{id:'rejected',status:'REJECTED',intakeOrderId:null},{id:'old-approved',status:'APPROVED',intakeOrderId:'cancelled'},{id:'parcel-cancelled',status:'APPROVED',intakeOrderId:'cancelled-shipment'},{id:'active',status:'APPROVED',intakeOrderId:'active'}];
 const visible=await visibleWebsiteOrders(rows);
 assert.deepEqual(visible.map(r=>r.id),['pending','active']);assert.equal(rows.length,5);
});
