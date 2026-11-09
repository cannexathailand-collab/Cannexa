import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {AuditLog} from '@prisma/client';
import {presentAudit} from '../src/lib/audit-report';
const log=(details:unknown,action='COMMISSION_PAID_BATCH'):AuditLog=>({id:'event',actor:'owner',action,entityId:'expense',details,createdAt:new Date('2026-11-05T17:52:15Z')}) as AuditLog;
test('rejected order history shows reason, telephone and sale total including older records',()=>{
 const event=presentAudit(log({reasons:['สินค้าไม่พอ'],phone:'0812345678',amountSatang:125000},'ORDER_REJECTED'));
 assert.equal(event.title,'ปฏิเสธการรับออเดอร์');
 assert.ok(event.summary.includes('สินค้าไม่พอ'));
 assert.ok(event.summary.includes('เบอร์ผู้รับ: 0812345678'));
 assert.ok(event.summary.some(line=>line.includes('1,250')));
 assert.deepEqual(presentAudit(log({reasons:['ไม่มีรหัสลูกค้า']},'ORDER_REJECTED')).summary,['ไม่มีรหัสลูกค้า']);
});
test('payment history displays each paid item and the account used',()=>{
 const event=presentAudit(log({salesIds:['a','b'],amountSatang:13200}),new Map([['sale:a',[{label:'ออเดอร์แรก',amountSatang:6600}]],['sale:b',[{label:'ออเดอร์ที่สอง',amountSatang:6600}]]]));
 assert.equal(event.items.length,2);assert.deepEqual(event.items.map(i=>i.amountSatang),[6600,6600]);assert.equal(event.actor,'บัญชีเจ้าของ (owner)');assert.equal(event.title,'บันทึกว่าจ่ายค่าคอมแล้ว');
});
test('recorded payment snapshot takes precedence over changed current data',()=>{
 const event=presentAudit(log({salesIds:['a'],items:[{label:'ค่าคอมยอดขาย',recipient:'Ink123',amountSatang:6600}]}),new Map([['sale:a',[{label:'changed',amountSatang:9900}]]]));
 assert.equal(event.items[0].amountSatang,6600);assert.match(event.items[0].label,/Ink123/);
});
test('expense history preserves individual lines without adding a grand total',()=>{
 const items=[{label:'หลอดไฟ',amountSatang:19300},{label:'กล่อง',amountSatang:65200},{label:'น้ำมัน',amountSatang:12000}];
 const event=presentAudit(log({amountSatang:96500},'EXPENSE_RECORDED_PAID'),new Map([['expense:expense',items]]));
 assert.deepEqual(event.items,items);assert.equal(event.items.reduce((n,i)=>n+i.amountSatang,0),96500);
});
test('settings history translates rates and preserves raw reference separately',()=>{
 const event=presentAudit(log({before:{salesCommissionBps:200},after:{salesCommissionBps:100}},'AFFILIATE_UPDATED'));
 assert.ok(event.summary.includes('ค่าคอมยอดขาย: 2% → 1%'));assert.equal(event.action,'AFFILIATE_UPDATED');
});
