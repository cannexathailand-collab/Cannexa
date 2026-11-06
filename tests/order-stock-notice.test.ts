import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {noticeFromReservation,stockNoticeText,confirmationMessages,getOrderStockNotice} from '../src/lib/order-stock-notice';
import {replyOrderConfirmation} from '../src/lib/order-confirmation';
const item={code:'A1',quantityMilliG:100000};
const plan=(remaining=250,pending=200,after=300)=>({sourceSheet:'stock',requests:[],changes:[{code:'A1',received:remaining,remainingBefore:remaining,remainingAfter:remaining,pendingBefore:pending,pendingAfter:after,completedBefore:0,completedAfter:0}]});
test('uses sellable stock after existing reservations: 250 remaining minus 200 pending leaves 50 for new 100G order',()=>{
 const n=noticeFromReservation([item],plan(),new Date());assert.equal(n.items[0].before,50000);assert.equal(n.items[0].after,-50000);
 assert.match(stockNoticeText(n),/เหลือเพียง 50 กรัม ไม่พอขาย/);assert.match(stockNoticeText(n),/สั่ง 100 กรัม · ขาด 50 กรัม/);
});
test('sufficient, exact depletion, empty and already oversold give distinct correct notices',()=>{
 assert.equal(stockNoticeText(noticeFromReservation([item],plan(500,200,300),new Date())), '');
 assert.match(stockNoticeText(noticeFromReservation([item],plan(300,200,300),new Date())),/หลังออเดอร์นี้สินค้าหมด.*มีสินค้าครบ/);
 assert.match(stockNoticeText(noticeFromReservation([item],plan(200,200,300),new Date())),/สินค้าหมด.*ขาด 100 กรัม/);
 assert.match(stockNoticeText(noticeFromReservation([item],plan(150,200,300),new Date())),/ขาด 100 กรัม/);
});
test('decimal arithmetic, legacy credits and unknown quantities avoid false shortages',()=>{
 const fractional={...item,quantityMilliG:200},p=plan(0.3,0.1,0.3);assert.equal(noticeFromReservation([fractional],p,new Date()).items[0].after,0);
 const credited=plan();Object.assign(credited.changes[0],{precountedBefore:100,precountedAfter:100});assert.equal(stockNoticeText(noticeFromReservation([item],credited,new Date())), '');
 const unknown=plan();Object.assign(unknown.changes[0],{remainingBefore:null,remainingAfter:null});assert.match(stockNoticeText(noticeFromReservation([item],unknown,new Date())),/ยังไม่ทราบจำนวน/);
 assert.throws(()=>noticeFromReservation([item],plan(250,200,299),new Date()),/MISMATCH/);
});
test('multiple items warn only the affected SKU and long replies fit LINE message bounds',()=>{
 const p=plan();p.changes.push({...plan(500,0,100).changes[0],code:'B1'});
 const n=noticeFromReservation([item,{...item,code:'B1'}],p,new Date());assert.ok(!stockNoticeText(n).includes('B1'));
 const long={...n,items:Array.from({length:50},(_,i)=>({...n.items[0],code:'A'.repeat(48)+i}))};
 const messages=confirmationMessages('บันทึกออเดอร์แล้ว',long);assert.ok(messages.length>1&&messages.length<=5);assert.ok(messages.every(m=>m.text.length<=5000));
});
test('verified reservation snapshot freezes notice across retries; busy lock and begun dispatch do not guess',async t=>{
 const restore:Array<()=>void>=[];const patch=(obj:any,key:string,value:any)=>{const old=obj[key];obj[key]=value;restore.push(()=>obj[key]=old);};t.after(()=>restore.reverse().forEach(fn=>fn()));
 let busy=false,started=false,saved:any=null,reads=0;
 patch(db,'$transaction',async(fn:any)=>fn(db));patch(db,'$queryRawUnsafe',async()=>[{locked:!busy}]);
 patch(db.stockWorkflow,'findUnique',async()=>({enabled:true,sourceSheet:'stock'}));
 patch(db.orderIntake,'findUnique',async()=>({id:'order',status:'WAITING_SHIPMENT'}));
 patch(db.auditLog,'findUnique',async()=>saved);patch(db.auditLog,'upsert',async({create}:any)=>{saved=create;return create;});
 patch(db.stockDispatch,'findUnique',async()=>started?{historySavedAt:new Date()}:null);
 patch(db.stockReturn,'findFirst',async()=>null);
 const reservation={orderId:'order',status:'RESERVED',items:[item],precounted:false,needsReconciliation:false};
 patch(db.stockReservation,'findUnique',async()=>reservation);patch(db.stockReservation,'findUniqueOrThrow',async()=>reservation);
 patch(db.stockSheetOperation,'findUnique',async({where}:any)=>{if(where.id.startsWith('dispatch:'))return null;reads++;return {status:'APPLIED',sourceSheet:'stock',appliedAt:new Date(),snapshot:plan()};});
 const first=await getOrderStockNotice('order');assert.match(stockNoticeText(first),/เหลือเพียง 50/);assert.equal(reads,1);
 assert.deepEqual(await getOrderStockNotice('order'),first);assert.equal(reads,1);
 saved=null;busy=true;assert.match(String(await getOrderStockNotice('order')),/ยังตรวจสอบ/);assert.equal(reads,1);
 busy=false;started=true;assert.equal(await getOrderStockNotice('order'),null);assert.equal(reads,1);
});
test('one LINE reply includes the shortage warning and concurrent redelivery cannot send it twice',async t=>{
 const restore:Array<()=>void>=[];const patch=(obj:any,key:string,value:any)=>{const old=obj[key];obj[key]=value;restore.push(()=>obj[key]=old);};t.after(()=>restore.reverse().forEach(fn=>fn()));
 process.env.USER_HASH_SECRET??='stock-notice-test';
 const order:any={id:'order',orderNumber:'TEST-ORDER',status:'WAITING_SHIPMENT',payment:'COD',affiliateId:null,replyStatus:'NOT_SENT',replyAttempts:0};
 patch(db.orderIntake,'findUnique',async()=>order);
 patch(db.orderIntake,'updateMany',async()=>{if(order.replyStatus!=='NOT_SENT')return {count:0};order.replyStatus='SENDING';return {count:1};});
 patch(db.orderIntake,'update',async({data}:any)=>Object.assign(order,data));
 patch(db.stockWorkflow,'findUnique',async()=>({enabled:true}));patch(db,'$transaction',async(fn:any)=>fn(db));patch(db,'$queryRawUnsafe',async()=>[{locked:true}]);
 patch(db.auditLog,'findUnique',async()=>({details:noticeFromReservation([item],plan(),new Date())}));
 let sends=0;patch(globalThis,'fetch',async(url:string,init:any)=>{assert.equal(url,'https://api.line.me/v2/bot/message/reply');const body=JSON.parse(init.body);assert.match(body.messages.map((m:any)=>m.text).join('\n'),/เหลือเพียง 50 กรัม ไม่พอขาย/);assert.match(body.messages[0].text,/TEST-ORDER/);sends++;return new Response(null,{status:200});});
 const event:any={type:'message',source:{type:'group'},message:{type:'text',id:'message'},replyToken:'fake',webhookEventId:'event',timestamp:Date.now()};
 await Promise.all([replyOrderConfirmation('bot',event,'test'),replyOrderConfirmation('bot',event,'test')]);assert.equal(sends,1);assert.equal(order.replyStatus,'SENT');
 order.status='RETURNED';order.replyStatus='NOT_SENT';await replyOrderConfirmation('bot',event,'test');assert.equal(sends,1);
});
