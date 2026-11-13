import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {OrderCommissionStatus} from '../src/app/my-performance/order-commission-status';
import type {EmployeeCommission} from '../src/lib/employee-commissions';
const row:EmployeeCommission={id:'sale',kind:'COD',status:'PAID',amount:1250,date:new Date('2026-11-01'),paidAt:new Date('2026-11-02'),reference:'order',note:'Recorded commission'};
test('own commission status shows recorded paid amount and payment date with paid color',()=>{
 const html=renderToStaticMarkup(createElement(OrderCommissionStatus,{visible:true,language:'th',payment:'COD',codReceived:true,rows:[row]}));
 assert.ok(html.includes('จ่ายค่าคอมแล้ว'));assert.ok(html.includes('12.50'));assert.ok(html.includes('COD รับเงินแล้ว'));assert.ok(html.includes('commission-paid'));assert.ok(html.includes('จ่ายเมื่อ'));
});
test('unreceived COD and waiting commissions remain separate from paid commissions',()=>{
 const html=renderToStaticMarkup(createElement(OrderCommissionStatus,{visible:true,language:'th',payment:'COD',codReceived:false,rows:[{...row,status:'WAITING',amount:null,paidAt:null}]}));
 assert.ok(html.includes('commission-cod-waiting'));assert.ok(html.includes('commission-waiting'));assert.ok(!html.includes('จ่ายค่าคอมแล้ว'));assert.ok(html.includes('รอคำนวณ'));
});
test('shared orders do not expose personal commission status or amounts',()=>{
 assert.equal(renderToStaticMarkup(createElement(OrderCommissionStatus,{visible:false,payment:'COD',codReceived:true,rows:[row]})),'');
});
