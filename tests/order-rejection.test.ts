import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {replyOrderConfirmation} from '../src/lib/order-confirmation';
import {replyRejectedOrder} from '../src/lib/order-rejection';
import {orderRejectionReasons,orderRejectionText} from '../src/lib/order-validation';
import type {OrderEvent} from '../src/lib/order-intake';
process.env.USER_HASH_SECRET='rejection-test-only';
const event:OrderEvent={webhookEventId:'missing',timestamp:Date.now(),type:'message',source:{type:'group',groupId:'group'},message:{type:'text',id:'message',text:'รหัสผู้ขาย: ADM001\nผู้รับ: Sample\nโทร: 0812345678\nที่อยู่: 10 Bangkok 10200\nชำระเงิน: COD\nยอดรวม: 1250'},replyToken:'test'};
test('an order without customer code sends one rejection through the normal webhook reply path and no confirmation',async t=>{
 const restore:Array<()=>void>=[];const patch=(obj:any,key:string,value:any)=>{const old=obj[key];obj[key]=value;restore.push(()=>obj[key]=old);};t.after(()=>restore.reverse().forEach(fn=>fn()));
 let audit:any=null,sends=0;const tx={
  $queryRawUnsafe:async()=>[],orderMessageWithdrawal:{findUnique:async()=>null},orderIntake:{findFirst:async()=>null},
  auditLog:{findUnique:async()=>audit,create:async({data}:any)=>{audit=data;return audit;}}
 };
 patch(db,'$transaction',async(fn:any)=>fn(tx));patch(db.orderIntake,'findUnique',async()=>null);
 patch(db.orderGroup,'findUnique',async()=>({enabled:true,purpose:'ORDER'}));patch(db.auditLog,'update',async({data}:any)=>Object.assign(audit,data));
 patch(globalThis,'fetch',async(_url:any,options:any)=>{const body=JSON.parse(options.body);assert.equal(body.messages[0].text,orderRejectionText(['ไม่มีรหัสลูกค้า']));assert.ok(!body.messages[0].text.includes('บันทึกออเดอร์แล้ว'));sends++;return new Response(null,{status:200});});
 await replyOrderConfirmation('bot',event,'fake-token');await replyOrderConfirmation('bot',event,'fake-token');
 assert.equal(sends,1);assert.equal(audit.action,'ORDER_REJECTED');assert.equal(audit.details.status,'SENT');
 assert.equal(audit.details.phone,'0812345678');assert.equal(audit.details.amountSatang,125000);
 assert.equal(audit.details.eventAt,new Date(event.timestamp).toISOString());
});
test('unapproved groups, expense groups and messages with a code do not receive the missing-code reply',async t=>{
 const oldGroup=db.orderGroup.findUnique,oldFetch=globalThis.fetch;t.after(()=>{db.orderGroup.findUnique=oldGroup;globalThis.fetch=oldFetch;});
 globalThis.fetch=async()=>{assert.fail('must not send');};
 for(const group of [null,{enabled:false,purpose:'ORDER'},{enabled:true,purpose:'EXPENSE'}]){
  db.orderGroup.findUnique=(async()=>group) as any;await replyRejectedOrder('bot',event,'fake-token');
 }
 await replyRejectedOrder('bot',{...event,message:{...event.message!,text:event.message!.text+'\nรหัสลูกค้า: C0001'}},'fake-token');
});

test('rejection identifies missing postal codes and combines all blocking reasons',()=>{
 assert.deepEqual(orderRejectionReasons({customerCode:'C0001',address:'10 Bangkok 1020',phone:'0812345678'}),['รหัสไปรษณีย์ไม่ครบ 5 หลัก']);
 assert.deepEqual(orderRejectionReasons({address:'10 Bangkok',phone:'0812345678'}),['ไม่มีรหัสลูกค้า','รหัสไปรษณีย์ไม่ครบ 5 หลัก']);
 assert.deepEqual(orderRejectionReasons({customerCode:'C0001',address:'85000, Mueang Ranong, Ranong',phone:'+66 81 234 5678'}),[]);
 assert.deepEqual(orderRejectionReasons({customerCode:'C0001',address:'Bangkok 10200',phone:'081234567'}),['เบอร์โทรไม่ครบ 10 หลัก']);
 assert.match(orderRejectionText(['รหัสไปรษณีย์ไม่ครบ 5 หลัก']),/^บันทึกไม่สำเร็จ: รหัสไปรษณีย์ไม่ครบ 5 หลัก/);
 assert.match(orderRejectionText(['สินค้า NT18 ไม่พอ · จำนวนที่จำหน่ายได้ 23 กรัม · สั่ง 30 กรัม']),/^บันทึกไม่สำเร็จ: สินค้าไม่ครบ · สินค้า NT18 ไม่พอ/);
 assert.match(orderRejectionText(['สินค้า NT18 หมดสำหรับขาย · จำนวนที่จำหน่ายได้ 0 กรัม']),/^บันทึกไม่สำเร็จ: สินค้าไม่ครบ/);
 assert.doesNotMatch(orderRejectionText(['ยังตรวจสอบจำนวนสินค้า NT18 ไม่ได้']),/สินค้าไม่ครบ/);
});

test('stock rejection retains matching details when the LINE reply fails',async t=>{
 const restore:Array<()=>void>=[];const patch=(obj:any,key:string,value:any)=>{const old=obj[key];obj[key]=value;restore.push(()=>obj[key]=old);};t.after(()=>restore.reverse().forEach(fn=>fn()));
 let audit:any={details:{status:'READY',reasons:['สินค้า NT18 ไม่พอ']}};
 let sentText='';
 const update=async({data}:any)=>Object.assign(audit,data);
 const tx={$queryRawUnsafe:async()=>[],orderMessageWithdrawal:{findUnique:async()=>null},orderIntake:{findFirst:async()=>null},auditLog:{findUnique:async()=>audit,update}};
 patch(db,'$transaction',async(fn:any)=>fn(tx));
 patch(db.orderGroup,'findUnique',async()=>({enabled:true,purpose:'ORDER'}));
 patch(db.auditLog,'update',update);
 patch(globalThis,'fetch',async(_url:any,options:any)=>{
  sentText=JSON.parse(options.body).messages[0].text;
  throw Error('network unavailable');
 });
 await replyRejectedOrder('bot',{...event,message:{...event.message!,text:event.message!.text+'\nรหัสลูกค้า: C0001'}},'fake-token');
 assert.match(sentText,/^บันทึกไม่สำเร็จ: สินค้าไม่ครบ · สินค้า NT18 ไม่พอ/);
 assert.deepEqual(audit.details,{status:'DELIVERY_UNCONFIRMED',reasons:['สินค้า NT18 ไม่พอ'],phone:'0812345678',amountSatang:125000,eventAt:new Date(event.timestamp).toISOString()});
});
