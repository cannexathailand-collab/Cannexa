import {test,afterEach} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {receiveOrderEvent,type OrderEvent} from "../src/lib/order-intake";
process.env.USER_HASH_SECRET="intake-test-secret-only";
const txOriginal=db.$transaction,groupOriginal=db.orderGroup.upsert;
afterEach(()=>{db.$transaction=txOriginal;db.orderGroup.upsert=groupOriginal;});
function harness(enabled=true){
 const rows:any[]=[],groups=new Map<string,any>(),withdrawn=new Set<string>();
 db.orderGroup.upsert=(async({where,create}:any)=>{if(!groups.has(where.id))groups.set(where.id,{...create,enabled});return groups.get(where.id);}) as any;
 const tx:any={$queryRawUnsafe:async()=>[],orderGroup:{findUnique:async({where}:any)=>groups.get(where.id)},affiliate:{findMany:async({where}:any)=>{assert.equal(where.OR[0].code.mode,"insensitive");assert.equal(where.OR[1].accounts.some.username.mode,"insensitive");return [{id:"seller",salesCommissionBasis:"REVENUE",salesCommissionBps:1000}];}},orderMessageWithdrawal:{findUnique:async({where}:any)=>withdrawn.has(where.messageKey)?{}:null,upsert:async({where}:any)=>withdrawn.add(where.messageKey)},salesOrder:{updateMany:async()=>({count:0})},orderIntake:{findMany:async({where}:any)=>rows.filter(r=>r.messageKey===where.messageKey&&r.groupKey===where.groupKey),findFirst:async({where}:any)=>rows.find(r=>where.OR.some((q:any)=>(q.messageKey&&q.messageKey===r.messageKey)||(q.eventKey&&q.eventKey===r.eventKey))),create:async({data}:any)=>{const row={id:"order-"+rows.length,...data};rows.push(row);return row;},updateMany:async({where,data}:any)=>{rows.filter(r=>r.messageKey===where.messageKey&&r.groupKey===where.groupKey).forEach(r=>Object.assign(r,data));}}};
 db.$transaction=(async(fn:any)=>fn(tx)) as any;
 return {rows,groups,tx};
}
function event(message="m1"):OrderEvent{return {webhookEventId:"e-"+message,type:"message",timestamp:Date.now(),source:{type:"group",groupId:"group",userId:"person"},message:{type:"text",id:message,text:"รหัสผู้ขาย: ADM001\nผู้รับ: ตัวอย่าง\nโทร: 0812345678\nที่อยู่: 1\nชำระเงิน: COD\nยอดรวม: 2560"}};}
test("repeated webhook and message IDs save once, identical separate messages save twice",async()=>{
 const h=harness();await receiveOrderEvent("bot-a",event());await receiveOrderEvent("bot-a",event());await receiveOrderEvent("bot-a",{...event(),webhookEventId:"redelivered"});await receiveOrderEvent("bot-a",event("m2"));assert.equal(h.rows.length,2);assert.notEqual(h.rows[0].orderNumber,h.rows[1].orderNumber);assert.equal(h.rows[0].status,"WAITING_SHIPMENT");
 // No sale or commission delegate is provided: the intake must not post either.
});
test("unapproved groups and personal chats never store order text",async()=>{
 const h=harness(false);await receiveOrderEvent("bot-a",event());await receiveOrderEvent("bot-a",{...event(),source:{type:"user",userId:"person"}});assert.equal(h.rows.length,0);assert.equal(h.groups.size,1);
});
test("different stores keep message identities separate",async()=>{
 const h=harness();await receiveOrderEvent("bot-a",event());await receiveOrderEvent("bot-b",event());assert.equal(h.rows.length,2);assert.notEqual(h.rows[0].groupKey,h.rows[1].groupKey);
});
test("unknown or ambiguous sellers remain review-only",async()=>{
 const h=harness();h.tx.affiliate.findMany=async()=>[];await receiveOrderEvent("bot-a",event());assert.equal(h.rows[0].affiliateId,null);assert.equal(h.rows[0].status,"NEEDS_REVIEW");
});
test("unsend erases customer text and blocks out-of-order redelivery",async()=>{
 const h=harness();await receiveOrderEvent("bot-a",event());const unsend={...event(),type:"unsend",message:undefined,unsend:{messageId:"m1"}};await receiveOrderEvent("bot-a",unsend);assert.equal(h.rows[0].rawText,null);assert.equal(h.rows[0].phone,null);assert.equal(h.rows[0].status,"WITHDRAWN");await receiveOrderEvent("bot-a",event());assert.equal(h.rows.length,1);
 await receiveOrderEvent("bot-a",{...unsend,unsend:{messageId:"m2"}});await receiveOrderEvent("bot-a",event("m2"));assert.equal(h.rows.length,1);
});
