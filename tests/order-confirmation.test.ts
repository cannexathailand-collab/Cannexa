import {test} from 'node:test';import assert from 'node:assert/strict';import {db} from '../src/lib/db';
import {orderConfirmationText,replyOrderConfirmation} from '../src/lib/order-confirmation';import type {OrderEvent} from '../src/lib/order-intake';
process.env.USER_HASH_SECRET='confirmation-test-only';
const summary={pendingSatang:1250,membership:'Gold',points:150},seller={name:'อิ้ง',code:'11155'};
const order={orderNumber:'ORD-TEST',payment:'โอน',status:'TRANSFER_RECORDED',issues:[],sellerCode:'Ink123',customerCode:'C0001'};
test('confirmation uses the approved four-line format with cumulative commission, member tier and points',()=>{
 const text=orderConfirmationText(order,{status:'PENDING',commissionSatang:200},seller,summary);
 assert.equal(text,'บันทึกออเดอร์แล้ว\nผู้ขาย: อิ้ง | ค่าคอมรอรับสะสม: 12.50 บาท\nลูกค้า: C0001 | Member: Gold\nGreen Coin: 150 Green Coin');assert.ok(!text.includes('ORD-TEST'));assert.ok(!text.includes('บันทึกให้ Affiliate'));
});
test('waiting COD never adds an unearned commission or claims received payment',()=>{
 const text=orderConfirmationText({...order,payment:'COD',status:'WAITING_SHIPMENT'},null,seller,{...summary,pendingSatang:0});assert.ok(text.includes('0.00 บาท · รายการนี้รอคำนวณ'));assert.equal(text.split('\n').length,4);assert.ok(!text.includes('ยืนยันยอดขาย'));
});
test('unknown context does not invent a customer, tier or points',()=>{const text=orderConfirmationText({...order,customerCode:null},null,null);assert.ok(text.includes('รอคำนวณ'));assert.ok(text.includes('Member: ยังไม่ระบุ'));assert.ok(text.includes('Green Coin: รอข้อมูล'));});
test('invalid phone warning retains the correction path and claim excludes new commission',()=>{
 const text=orderConfirmationText({...order,status:'NEEDS_REVIEW',issues:['เบอร์โทรไม่ถูกต้อง']},null,seller,summary);assert.ok(text.includes('กรุณาตรวจเบอร์โทรผู้รับ'));assert.ok(text.includes('ยกเลิกข้อความออเดอร์เดิม'));
 assert.ok(orderConfirmationText({...order,payment:'เคลม'},null,seller,summary).includes('ไม่เพิ่มยอดขายหรือค่าคอม'));
});
const event:OrderEvent={webhookEventId:'event',timestamp:Date.now(),type:'message',source:{type:'group',groupId:'group'},message:{type:'text',id:'message',text:'รหัสผู้ขาย: ADM001\nรหัสลูกค้า: C0001\nที่อยู่: Bangkok 10200\nโทร: 0812345678'},replyToken:'test-reply-token'};
test('stored order sends compact reply once and duplicate delivery does not send twice',async t=>{
 const restore:Array<()=>void>=[];const patch=(obj:any,key:string,value:any)=>{const old=obj[key];obj[key]=value;restore.push(()=>obj[key]=old);};t.after(()=>restore.reverse().forEach(fn=>fn()));
 const stored={...order,affiliateId:'linked-affiliate',id:'order',replyStatus:'NOT_SENT',replyAttempts:0};let sends=0;
 patch(db.affiliate,'findUnique',async()=>seller);patch(db.salesOrder,'findUnique',async()=>({affiliateId:'linked-affiliate',status:'PENDING',commissionSatang:200}));
 patch(db.orderIntake,'findUnique',async()=>stored);patch(db.orderIntake,'updateMany',async({data}:any)=>{if(!['NOT_SENT','FAILED','NOT_CONFIGURED'].includes(stored.replyStatus))return {count:0};Object.assign(stored,{replyStatus:data.replyStatus,replyAttempts:stored.replyAttempts+1});return {count:1};});patch(db.orderIntake,'update',async({data}:any)=>Object.assign(stored,data));
 patch(globalThis,'fetch',async(input:any,options:any)=>{assert.equal(input,'https://api.line.me/v2/bot/message/reply');const body=JSON.parse(options.body);assert.equal(body.replyToken,event.replyToken);assert.ok(body.messages[0].text.includes('ค่าคอมรอรับสะสม: 12.50 บาท'));assert.ok(!body.messages[0].text.includes('ORD-TEST'));sends++;return new Response(null,{status:200});});
 await replyOrderConfirmation('bot',event,'test-access-token',async()=>summary);await replyOrderConfirmation('bot',event,'test-access-token',async()=>summary);assert.equal(sends,1);assert.equal(stored.replyStatus,'SENT');
});
test('no stored order or pending rejection sends no confirmation',async t=>{
 const old=db.orderIntake.findUnique,oldGroup=db.orderGroup.findUnique,oldTransaction=db.$transaction;
 t.after(()=>{db.orderIntake.findUnique=old;db.orderGroup.findUnique=oldGroup;db.$transaction=oldTransaction;});
 db.orderIntake.findUnique=(async()=>null) as any;db.orderGroup.findUnique=(async()=>({enabled:true,purpose:'ORDER'})) as any;
 db.$transaction=(async(fn:any)=>fn({$queryRawUnsafe:async()=>[],orderMessageWithdrawal:{findUnique:async()=>null},orderIntake:{findFirst:async()=>null},auditLog:{findUnique:async()=>null}})) as any;
 await replyOrderConfirmation('bot',event,'token',async()=>summary);
});
