import {test} from 'node:test';import assert from 'node:assert/strict';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {OrderCard} from '../src/app/order-card';import {orderShipmentStatus} from '../src/lib/order-shipment-status';import type {OrderIntake} from '@prisma/client';
test('matching needs a tracking number and dispatch needs separate confirmed evidence',()=>{
 assert.equal(orderShipmentStatus('WAITING_SHIPMENT').label,'ยังไม่จับคู่');
 assert.equal(orderShipmentStatus('WAITING_SHIPMENT',undefined,'DISPATCHED',new Date()).matched,false);
 assert.equal(orderShipmentStatus('MATCHED_SHIPMENT','TRACK').label,'จับคู่สำเร็จ');
 assert.equal(orderShipmentStatus('MATCHED_SHIPMENT','TRACK','DISPATCHED',new Date()).label,'จับคู่สำเร็จ · จัดส่งแล้ว');
 assert.equal(orderShipmentStatus('RETURNED','TRACK','DISPATCHED',new Date()).label,'พัสดุตีกลับ');
 assert.equal(orderShipmentStatus('CANCELLED','TRACK','DISPATCHED',new Date()).label,'ยกเลิก');
});
test('shared owner and employee order card visibly includes match status and tracking',()=>{
 const order={id:'test',orderNumber:'ORD-TEST',status:'MATCHED_SHIPMENT',payment:'COD',eventAt:new Date(),createdAt:new Date(),issues:[],replyStatus:'SENT'} as unknown as OrderIntake;
 const html=renderToStaticMarkup(createElement(OrderCard,{order,tracking:'TRACK-123',fulfillmentStatus:'DISPATCHED',dispatchedAt:new Date()}));
 assert.ok(html.includes('จับคู่สำเร็จ · จัดส่งแล้ว'));assert.ok(html.includes('เลขพัสดุ:'));assert.ok(html.includes('TRACK-123'));
 const pending=renderToStaticMarkup(createElement(OrderCard,{order}));assert.ok(pending.includes('ยังไม่จับคู่'));assert.ok(!pending.includes('จับคู่สำเร็จ'));
});
