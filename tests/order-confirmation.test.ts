import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {orderConfirmationText,replyOrderConfirmation} from "../src/lib/order-confirmation";
import type {OrderEvent} from "../src/lib/order-intake";
process.env.USER_HASH_SECRET="confirmation-test-only";
const event:OrderEvent={webhookEventId:"event",timestamp:Date.now(),type:"message",source:{type:"group",groupId:"group"},message:{type:"text",id:"message",text:"รหัสผู้ขาย: ADM001"},replyToken:"test-reply-token"};
test("transfer confirmation never claims unverified slip or commission success",()=>{const text=orderConfirmationText({orderNumber:"ORD-TEST",payment:"โอน",status:"WAITING_SHIPMENT",issues:[]});assert.ok(text.includes("รอตรวจสลิปจริง"));assert.ok(text.includes("ยังไม่บันทึกค่าคอม"));assert.equal(text.includes("ค่าคอมสำเร็จ"),false);assert.ok(orderConfirmationText({orderNumber:"ORD-TEST",payment:"COD",status:"WAITING_SHIPMENT",issues:[]}).includes("รอจับคู่รายงานจัดส่งจริง"));});
test("reply is sent once after stored order, and repeat delivery does not send twice",async t=>{
 const original={fetch:globalThis.fetch,find:db.orderIntake.findUnique,many:db.orderIntake.updateMany,update:db.orderIntake.update};t.after(()=>{globalThis.fetch=original.fetch;db.orderIntake.findUnique=original.find;db.orderIntake.updateMany=original.many;db.orderIntake.update=original.update;});
 const order={id:"order",orderNumber:"ORD-TEST",payment:"COD",status:"WAITING_SHIPMENT",issues:[],replyStatus:"NOT_SENT",replyAttempts:0};let sends=0;
 db.orderIntake.findUnique=(async()=>order) as any;
 db.orderIntake.updateMany=(async({data}:any)=>{if(!["NOT_SENT","FAILED","NOT_CONFIGURED"].includes(order.replyStatus))return {count:0};Object.assign(order,{replyStatus:data.replyStatus,replyAttempts:order.replyAttempts+1});return {count:1};}) as any;
 db.orderIntake.update=(async({data}:any)=>Object.assign(order,data)) as any;
 globalThis.fetch=async(input,options)=>{assert.equal(input,"https://api.line.me/v2/bot/message/reply");const body=JSON.parse(String(options?.body));assert.equal(body.replyToken,event.replyToken);assert.ok(body.messages[0].text.includes("ORD-TEST"));sends++;return new Response(null,{status:200});};
 await replyOrderConfirmation("bot",event,"test-access-token");await replyOrderConfirmation("bot",event,"test-access-token");assert.equal(sends,1);assert.equal(order.replyStatus,"SENT");
});
test("no stored order means no confirmation is sent",async t=>{const original=db.orderIntake.findUnique,fetchOriginal=globalThis.fetch;t.after(()=>{db.orderIntake.findUnique=original;globalThis.fetch=fetchOriginal;});db.orderIntake.findUnique=(async()=>null) as any;globalThis.fetch=async()=>{assert.fail("Must not send");};await replyOrderConfirmation("bot",event,"token");});
