import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {orderConfirmationText,replyOrderConfirmation} from "../src/lib/order-confirmation";
import type {OrderEvent} from "../src/lib/order-intake";
process.env.USER_HASH_SECRET="confirmation-test-only";
test("confirmation identifies the linked affiliate and preserves submitted seller code",()=>{
 const o={orderNumber:"ORD-TEST",payment:"COD",status:"WAITING_SHIPMENT",issues:[],sellerCode:"Ink123"};
 const text=orderConfirmationText(o,null,{name:"อิ้ง",code:"11155"});
 assert.ok(text.includes("รหัสผู้ขาย: Ink123"));assert.ok(text.includes("ชื่อผู้ขาย: อิ้ง"));assert.ok(text.includes("บันทึกให้ Affiliate: 11155"));
 const unlinked=orderConfirmationText(o);assert.ok(unlinked.includes("ยังไม่สามารถระบุบัญชีผู้ขายได้"));assert.ok(!unlinked.includes("บันทึกให้ Affiliate:"));
});
const event:OrderEvent={webhookEventId:"event",timestamp:Date.now(),type:"message",source:{type:"group",groupId:"group"},message:{type:"text",id:"message",text:"รหัสผู้ขาย: ADM001"},replyToken:"test-reply-token"};
test("unrecorded transfer confirmation never claims commission success",()=>{const text=orderConfirmationText({orderNumber:"ORD-TEST",payment:"โอน",status:"WAITING_SHIPMENT",issues:[]});assert.equal(text.includes("สลิปผ่าน"),false);assert.ok(text.includes("ยังไม่บันทึกค่าคอม"));assert.equal(text.includes("ค่าคอมสำเร็จ"),false);assert.ok(orderConfirmationText({orderNumber:"ORD-TEST",payment:"COD",status:"WAITING_SHIPMENT",issues:[]}).includes("รอจับคู่รายงานจัดส่งจริง"));});
test("reply is sent once after stored order, and repeat delivery does not send twice",async t=>{
 const original={fetch:globalThis.fetch,find:db.orderIntake.findUnique,many:db.orderIntake.updateMany,update:db.orderIntake.update,seller:db.affiliate.findUnique};t.after(()=>{globalThis.fetch=original.fetch;db.orderIntake.findUnique=original.find;db.orderIntake.updateMany=original.many;db.orderIntake.update=original.update;db.affiliate.findUnique=original.seller;});
 db.affiliate.findUnique=(async({where}:any)=>{assert.equal(where.id,"linked-affiliate");return {name:"อิ้ง",code:"11155"};}) as any;
 const order={affiliateId:"linked-affiliate",sellerCode:"Ink123",id:"order",orderNumber:"ORD-TEST",payment:"COD",status:"WAITING_SHIPMENT",issues:[],replyStatus:"NOT_SENT",replyAttempts:0};let sends=0;
 db.orderIntake.findUnique=(async()=>order) as any;
 db.orderIntake.updateMany=(async({data}:any)=>{if(!["NOT_SENT","FAILED","NOT_CONFIGURED"].includes(order.replyStatus))return {count:0};Object.assign(order,{replyStatus:data.replyStatus,replyAttempts:order.replyAttempts+1});return {count:1};}) as any;
 db.orderIntake.update=(async({data}:any)=>Object.assign(order,data)) as any;
 globalThis.fetch=async(input,options)=>{assert.equal(input,"https://api.line.me/v2/bot/message/reply");const body=JSON.parse(String(options?.body));assert.equal(body.replyToken,event.replyToken);assert.ok(body.messages[0].text.includes("ORD-TEST"));assert.ok(body.messages[0].text.includes("ชื่อผู้ขาย: อิ้ง"));assert.ok(body.messages[0].text.includes("บันทึกให้ Affiliate: 11155"));sends++;return new Response(null,{status:200});};
 await replyOrderConfirmation("bot",event,"test-access-token");await replyOrderConfirmation("bot",event,"test-access-token");assert.equal(sends,1);assert.equal(order.replyStatus,"SENT");
});
test("no stored order means no confirmation is sent",async t=>{const original=db.orderIntake.findUnique,fetchOriginal=globalThis.fetch;t.after(()=>{db.orderIntake.findUnique=original;globalThis.fetch=fetchOriginal;});db.orderIntake.findUnique=(async()=>null) as any;globalThis.fetch=async()=>{assert.fail("Must not send");};await replyOrderConfirmation("bot",event,"token");});
test("recorded transfer confirmation states exact pending commission without claiming a verified slip",()=>{const text=orderConfirmationText({orderNumber:"ORD-TEST",payment:"โอน",status:"TRANSFER_RECORDED",issues:[]},{status:"PENDING",commissionSatang:1250});assert.ok(text.includes("บันทึกค่าคอมสำเร็จ ฿12.50"));assert.ok(text.includes("ไม่มีการตรวจสลิปอัตโนมัติ"));});
test("claim confirmation waits for inventory costs and never claims commission or COD matching",()=>{const text=orderConfirmationText({orderNumber:"ORD-TEST",payment:"เคลม",status:"CLAIM_WAITING_COST",issues:[]});assert.ok(text.includes("รอต้นทุนสินค้าจากสต็อก"));assert.ok(text.includes("ไม่รวมค่าส่ง"));assert.ok(text.includes("ไม่เพิ่มยอดขายหรือค่าคอม"));assert.ok(!text.includes("ค่าคอมสำเร็จ"));assert.ok(!text.includes("COD"));});
