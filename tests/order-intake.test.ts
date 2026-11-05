import {test,afterEach} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {receiveOrderEvent,type OrderEvent} from "../src/lib/order-intake";
process.env.USER_HASH_SECRET="intake-test-secret-only";
const txOriginal=db.$transaction,groupOriginal=db.orderGroup.upsert;
afterEach(()=>{db.$transaction=txOriginal;db.orderGroup.upsert=groupOriginal;});
function harness(enabled=true){
 const rows:any[]=[],sales:any[]=[],groups=new Map<string,any>(),withdrawn=new Set<string>();
 db.orderGroup.upsert=(async({where,create}:any)=>{if(!groups.has(where.id))groups.set(where.id,{...create,enabled});return groups.get(where.id);}) as any;
 const tx:any={shipment:{updateMany:async()=>({count:0})},$queryRawUnsafe:async()=>[],orderGroup:{findUnique:async({where}:any)=>groups.get(where.id)},affiliate:{findMany:async({where}:any)=>{assert.equal(where.OR[0].code.mode,"insensitive");assert.equal(where.OR[1].accounts.some.username.mode,"insensitive");return [{id:"seller",salesCommissionBasis:"REVENUE",salesCommissionBps:1000}];}},orderMessageWithdrawal:{findUnique:async({where}:any)=>withdrawn.has(where.messageKey)?{}:null,upsert:async({where}:any)=>withdrawn.add(where.messageKey)},auditLog:{create:async()=>({})},salesOrder:{findMany:async({where}:any)=>sales.filter(s=>where.orderId.in.includes(s.orderId)&&s.status!=="CANCELLED"),update:async({where,data}:any)=>{Object.assign(sales.find(s=>s.id===where.id),data);},create:async({data}:any)=>{assert.ok(!sales.some(s=>s.orderId===data.orderId));data.id="sale-"+sales.length;sales.push(data);return data;},updateMany:async({where,data}:any)=>{const selected=sales.filter(s=>where.orderId.in.includes(s.orderId)&&where.status.in.includes(s.status));selected.forEach(s=>Object.assign(s,data));return {count:selected.length};}},orderIntake:{deleteMany:async({where}:any)=>{for(let i=rows.length-1;i>=0;i--)if(rows[i].messageKey===where.messageKey&&rows[i].groupKey===where.groupKey)rows.splice(i,1);return {count:1};},findMany:async({where}:any)=>rows.filter(r=>r.messageKey===where.messageKey&&r.groupKey===where.groupKey),findFirst:async({where}:any)=>rows.find(r=>where.OR.some((q:any)=>(q.messageKey&&q.messageKey===r.messageKey)||(q.eventKey&&q.eventKey===r.eventKey))),create:async({data}:any)=>{const row={id:"order-"+rows.length,...data};rows.push(row);return row;},updateMany:async({where,data}:any)=>{rows.filter(r=>r.messageKey===where.messageKey&&r.groupKey===where.groupKey).forEach(r=>Object.assign(r,data));}}};
 db.$transaction=(async(fn:any)=>fn(tx)) as any;
 return {rows,groups,tx,sales};
}
function event(message="m1"):OrderEvent{return {webhookEventId:"e-"+message,type:"message",timestamp:Date.now(),source:{type:"group",groupId:"group",userId:"person"},message:{type:"text",id:message,text:"รหัสผู้ขาย: ADM001\nผู้รับ: ตัวอย่าง\nโทร: 0812345678\nที่อยู่: 1\nชำระเงิน: COD\nยอดรวม: 2560"}};}
test("shared affiliate orders belong to the matching employee, ambiguous code assigns nobody",async()=>{
 const h=harness();h.tx.affiliate.findMany=async()=>[{id:"seller",salesCommissionBasis:"REVENUE",salesCommissionBps:200,accounts:[{username:"adm001"},{username:"other"}]}];
 await receiveOrderEvent("bot-a",event());assert.equal(h.rows[0].sellerUsername,"adm001");
 const e=event("ambiguous");e.message!.text=e.message!.text!.replace("ADM001","11155");await receiveOrderEvent("bot-a",e);assert.equal(h.rows[1].sellerUsername,null);
});
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
 const h=harness();await receiveOrderEvent("bot-a",event());const unsend={...event(),type:"unsend",message:undefined,unsend:{messageId:"m1"}};await receiveOrderEvent("bot-a",unsend);assert.equal(h.rows.length,0);await receiveOrderEvent("bot-a",event());assert.equal(h.rows.length,0);
 await receiveOrderEvent("bot-a",{...unsend,unsend:{messageId:"m2"}});await receiveOrderEvent("bot-a",event("m2"));assert.equal(h.rows.length,0);
});
test("declared transfer credits once immediately and unsend reverses pending commission",async()=>{
 const h=harness(),e=event();e.message!.text=e.message!.text!.replace("ชำระเงิน: COD","ชำระเงิน: โอน");
 await receiveOrderEvent("bot-a",e);await receiveOrderEvent("bot-a",e);
 assert.equal(h.sales.length,1);assert.equal(h.sales[0].revenueSatang,256000);assert.equal(h.sales[0].commissionSatang,25600);assert.equal(h.sales[0].paymentEvidence,"DECLARED_TRANSFER");assert.equal(h.rows[0].status,"TRANSFER_RECORDED");
 await receiveOrderEvent("bot-a",{...e,type:"unsend",message:undefined,unsend:{messageId:e.message!.id}});assert.equal(h.sales[0].status,"CANCELLED");assert.equal(h.sales[0].commissionSatang,0);
});
test("transfer with missing total stays review-only, profit basis waits for costs",async()=>{
 const h=harness(),e=event();e.message!.text=e.message!.text!.replace("ชำระเงิน: COD","ชำระเงิน: โอน").replace("ยอดรวม: 2560","");await receiveOrderEvent("bot-a",e);assert.equal(h.sales.length,0);assert.equal(h.rows[0].status,"NEEDS_REVIEW");
 h.tx.affiliate.findMany=async()=>[{id:"seller",salesCommissionBasis:"PROFIT",salesCommissionBps:1000}];const profit=event("profit");profit.message!.text=profit.message!.text!.replace("ชำระเงิน: COD","ชำระเงิน: โอน");await receiveOrderEvent("bot-a",profit);assert.equal(h.sales[0].commissionSatang,null);assert.equal(h.sales[0].status,"WAITING_COST");
});
test("claim records no sale or commission and waits for inventory cost, not shipment matching",async()=>{
 const h=harness(),e=event();e.message!.text=e.message!.text!.replace("ชำระเงิน: COD","ชำระเงิน: เครม");await receiveOrderEvent("bot-a",e);await receiveOrderEvent("bot-a",e);
 assert.equal(h.rows.length,1);assert.equal(h.rows[0].payment,"เคลม");assert.equal(h.rows[0].status,"CLAIM_WAITING_COST");assert.equal(h.sales.length,0);
});
test("unsend keeps independently confirmed returned parcel history",async()=>{
 const h=harness();await receiveOrderEvent("bot-a",event());let checked=false;
 h.tx.shipment.updateMany=async({where}:any)=>{assert.equal(where.status.not,"RETURNED");checked=true;return {count:0};};
 await receiveOrderEvent("bot-a",{...event(),type:"unsend",message:undefined,unsend:{messageId:"m1"}});assert.ok(checked);assert.equal(h.rows.length,0);
});
