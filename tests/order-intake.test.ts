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
 const tx:any={shipment:{updateMany:async()=>({count:0})},$queryRawUnsafe:async()=>[],orderGroup:{findUnique:async({where}:any)=>groups.get(where.id)},affiliate:{findMany:async({where}:any)=>{assert.equal(where.OR[0].code.mode,"insensitive");assert.equal(where.OR[1].accounts.some.username.mode,"insensitive");return [{id:"seller",salesCommissionBasis:"REVENUE",salesCommissionBps:1000}];}},orderMessageWithdrawal:{findUnique:async({where}:any)=>withdrawn.has(where.messageKey)?{}:null,upsert:async({where}:any)=>withdrawn.add(where.messageKey)},auditLog:{findUnique:async()=>null,create:async()=>({})},salesOrder:{findMany:async({where}:any)=>sales.filter(s=>where.orderId.in.includes(s.orderId)&&s.status!=="CANCELLED"),update:async({where,data}:any)=>{Object.assign(sales.find(s=>s.id===where.id),data);},create:async({data}:any)=>{assert.ok(!sales.some(s=>s.orderId===data.orderId));data.id="sale-"+sales.length;sales.push(data);return data;},updateMany:async({where,data}:any)=>{const selected=sales.filter(s=>where.orderId.in.includes(s.orderId)&&where.status.in.includes(s.status));selected.forEach(s=>Object.assign(s,data));return {count:selected.length};}},orderIntake:{deleteMany:async({where}:any)=>{for(let i=rows.length-1;i>=0;i--)if(rows[i].messageKey===where.messageKey&&rows[i].groupKey===where.groupKey)rows.splice(i,1);return {count:1};},findMany:async({where}:any)=>rows.filter(r=>r.messageKey===where.messageKey&&r.groupKey===where.groupKey),findFirst:async({where}:any)=>rows.find(r=>where.OR.some((q:any)=>(q.messageKey&&q.messageKey===r.messageKey)||(q.eventKey&&q.eventKey===r.eventKey))),create:async({data}:any)=>{const row={id:"order-"+rows.length,...data};rows.push(row);return row;},updateMany:async({where,data}:any)=>{rows.filter(r=>r.messageKey===where.messageKey&&r.groupKey===where.groupKey).forEach(r=>Object.assign(r,data));}}};
 db.$transaction=(async(fn:any)=>fn(tx)) as any;
 tx.additionalCommission={create:async({data}:any)=>data};
 tx.crmPointRule={findFirst:async()=>null}; tx.stockWorkflow={findUnique:async()=>null};
 const customers:any[]=[{code:'CUS-00000001',referrerId:'seller'}];
 tx.customer={findUnique:async({where}:any)=>customers.find(c=>where.code?c.code===where.code:c.identityKey===where.identityKey)??null,update:async({where,data}:any)=>Object.assign(customers.find(c=>c.code===where.code),data),upsert:async({where,create}:any)=>{let c=customers.find(c=>c.identityKey===where.identityKey);if(!c){c={code:'CUS-'+String(customers.length+1).padStart(8,'0'),...create};customers.push(c);}return c;}};
 return {rows,groups,tx,sales,customers};
}
function event(message="m1"):OrderEvent{return {webhookEventId:"e-"+message,type:"message",timestamp:Date.now(),source:{type:"group",groupId:"group",userId:"person"},message:{type:"text",id:message,text:"รหัสผู้ขาย: ADM001\nผู้รับ: ตัวอย่าง\nโทร: 0812345678\nที่อยู่: 1 กรุงเทพ 10200\nชำระเงิน: COD\nยอดรวม: 2560\nรหัสลูกค้า: C0001"}};}
test('customer code links an order without replacing the seller or rewarding the referrer again',async()=>{
 const h=harness();
 h.tx.orderIntake.update=async({where,data}:any)=>Object.assign(h.rows.find(r=>r.id===where.id),data);
 const e=event();e.message!.text=e.message!.text!.replace('C0001','cus-00000001');const order=await receiveOrderEvent('bot-a',e);
 assert.equal(order?.customerCode,'CUS-00000001');assert.equal(order?.affiliateId,'seller');assert.equal(h.sales.length,0);
 await receiveOrderEvent('bot-a',e);assert.equal(h.rows.length,1);
 const bad=event('bad-customer');bad.message!.text=bad.message!.text!.replace('C0001','CUS-99999999');const invalid=await receiveOrderEvent('bot-a',bad);
 assert.equal(invalid?.status,'NEEDS_REVIEW');assert.equal(invalid?.customerCode,null);assert.ok((invalid?.issues as string[]).some(i=>i.includes('รหัสลูกค้า')));
});

test('missing or blank customer code rejects COD, transfer and claim before any order or customer write',async()=>{
 for(const payment of ['COD','โอน','เคลม'])for(const suffix of ['', '\nรหัสลูกค้า:   ']){
  const h=harness(),e=event('missing-'+payment+suffix.length);
  e.message!.text=e.message!.text!.replace('\nรหัสลูกค้า: C0001',suffix).replace('ชำระเงิน: COD','ชำระเงิน: '+payment);
  h.tx.customer={findUnique:async()=>assert.fail('must not resolve customer'),upsert:async()=>assert.fail('must not create customer')};
  assert.equal(await receiveOrderEvent('bot-a',e),null);assert.equal(h.rows.length,0);assert.equal(h.sales.length,0);assert.equal(h.customers.length,1);
 }
});

test('missing or incomplete postcode prevents all order and financial writes',async()=>{
 for(const address of ['10 Bangkok','10 Bangkok 1020','12345 ถนนทดสอบ']){
  const h=harness(),e=event('postal');e.message!.text=e.message!.text!.replace('1 กรุงเทพ 10200',address);
  h.tx.customer={findUnique:async()=>assert.fail('must not resolve customer')};
  assert.equal(await receiveOrderEvent('bot-a',e),null);assert.equal(h.rows.length,0);assert.equal(h.sales.length,0);
 }
});

test('missing or incomplete phone prevents order and customer creation',async()=>{
 for(const phone of ['','081234567','0000000000']){
  const h=harness(),e=event('phone');e.message!.text=e.message!.text!.replace('0812345678',phone);
  h.tx.customer={findUnique:async()=>assert.fail('must not resolve customer')};
  assert.equal(await receiveOrderEvent('bot-a',e),null);assert.equal(h.rows.length,0);assert.equal(h.sales.length,0);
 }
});
test("shared affiliate orders belong to the matching employee, ambiguous code assigns nobody",async()=>{
 const h=harness();h.tx.affiliate.findMany=async()=>[{id:"seller",salesCommissionBasis:"REVENUE",salesCommissionBps:200,accounts:[{username:"adm001"},{username:"other"}]}];
 await receiveOrderEvent("bot-a",event());assert.equal(h.rows[0].sellerUsername,"adm001");
 const e=event("ambiguous");e.message!.text=e.message!.text!.replace("ADM001","11155");await receiveOrderEvent("bot-a",e);assert.equal(h.rows[1].sellerUsername,null);
});
test('existing customer survives repeat purchase and a different selling employee with one commission per order',async()=>{
 const h=harness();h.customers[0].referrerId='first';let current='first';
 const first={id:'first',salesCommissionBasis:'REVENUE',salesCommissionBps:200},second={id:'second',salesCommissionBasis:'REVENUE',salesCommissionBps:500};
 h.tx.affiliate.findMany=async()=>[current==='first'?first:second];h.tx.affiliate.findUnique=async()=>first;
 const make=(id:string)=>{const e=event(id);e.message!.text=e.message!.text!.replace('ชำระเงิน: COD','ชำระเงิน: โอน');return e;};
 const one=await receiveOrderEvent('bot-a',make('first-order'));current='second';
 const two=await receiveOrderEvent('bot-a',make('second-order'));await receiveOrderEvent('bot-a',make('second-order'));
 assert.equal(one?.customerCode,two?.customerCode);assert.equal(two?.affiliateId,'second');assert.equal(two?.commissionAffiliateId,'first');
 assert.equal(h.sales.length,2);assert.deepEqual(h.sales.map(s=>s.commissionBps),[200,200]);assert.deepEqual(h.sales.map(s=>s.affiliateId),['first','first']);
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
test('a short customer code resolves to the same existing customer and referrer',async()=>{
 const h=harness();const one=await receiveOrderEvent('bot-a',event('short-first'));assert.ok(one?.customerCode);
 const next=event('short-next');next.message!.text+='\nรหัสลูกค้า: C0001';const two=await receiveOrderEvent('bot-a',next);
 assert.equal(two?.customerCode,one.customerCode);assert.notEqual(two?.status,'NEEDS_REVIEW');
});
test('gross profit transfer snapshots the basis and waits for product and freight costs',async()=>{
 const h=harness();h.tx.affiliate.findMany=async()=>[{id:'seller',salesCommissionBasis:'GROSS_PROFIT',salesCommissionBps:1000}];
 const e=event('gross');e.message!.text=e.message!.text!.replace('ชำระเงิน: COD','ชำระเงิน: โอน');await receiveOrderEvent('bot-a',e);
 assert.equal(h.sales[0].commissionBasis,'GROSS_PROFIT');assert.equal(h.sales[0].commissionSatang,null);assert.equal(h.sales[0].status,'WAITING_COST');
});
test("claim records no sale or commission and waits for inventory cost, not shipment matching",async()=>{
 const h=harness(),e=event();e.message!.text=e.message!.text!.replace("ชำระเงิน: COD","ชำระเงิน: เครม");await receiveOrderEvent("bot-a",e);await receiveOrderEvent("bot-a",e);
 assert.equal(h.rows.length,1);assert.equal(h.rows[0].payment,"เคลม");assert.equal(h.rows[0].status,"CLAIM_WAITING_COST");assert.equal(h.sales.length,0);
});
test("unsend keeps independently confirmed returned parcel history",async()=>{
 const h=harness();await receiveOrderEvent("bot-a",event());let checked=false;
 h.tx.shipment.updateMany=async({where,data}:any)=>{if(data.orderId===null)assert.ok(where.orderId.in.length);else{assert.equal(where.status.not,"RETURNED");checked=true;}return {count:0};};
 await receiveOrderEvent("bot-a",{...event(),type:"unsend",message:undefined,unsend:{messageId:"m1"}});assert.ok(checked);assert.equal(h.rows.length,0);
});

test("sales rate changes preserve old transfer and waiting COD snapshots, new orders take the new rate",async()=>{
 const h=harness();let bps=200;h.tx.affiliate.findMany=async()=>[{id:"seller",salesCommissionBasis:"REVENUE",salesCommissionBps:bps}];
 const transfer=(id:string)=>{const e=event(id);e.message!.text=e.message!.text!.replace("ชำระเงิน: COD","ชำระเงิน: โอน");return e;};
 await receiveOrderEvent("bot-a",transfer("old-transfer"));await receiveOrderEvent("bot-a",event("old-cod"));bps=100;
 await receiveOrderEvent("bot-a",transfer("old-transfer"));await receiveOrderEvent("bot-a",transfer("new-transfer"));await receiveOrderEvent("bot-a",event("new-cod"));
 assert.deepEqual(h.rows.map(o=>o.salesCommissionBps),[200,200,100,100]);assert.deepEqual(h.sales.map(s=>s.commissionBps),[200,100]);assert.deepEqual(h.sales.map(s=>s.commissionSatang),[5120,2560]);
});
test('transfer and COD use independent rates frozen at intake, including zero and later rate changes',async()=>{
 const h=harness();let transferRate=200,codRate=500;
 h.tx.affiliate.findMany=async()=>[{id:'seller',salesCommissionBasis:'REVENUE',salesCommissionBps:1000,salesCommissionTransferBps:transferRate,salesCommissionCodBps:codRate}];
 const transfer=(id:string)=>{const e=event(id);e.message!.text=e.message!.text!.replace('ชำระเงิน: COD','ชำระเงิน: โอน');return e;};
 await receiveOrderEvent('bot-a',transfer('old-transfer'));await receiveOrderEvent('bot-a',event('old-cod'));
 transferRate=0;codRate=700;await receiveOrderEvent('bot-a',transfer('old-transfer'));await receiveOrderEvent('bot-a',transfer('new-transfer'));await receiveOrderEvent('bot-a',event('new-cod'));
 assert.deepEqual(h.rows.map(o=>o.salesCommissionBps),[200,500,0,700]);assert.deepEqual(h.sales.map(s=>s.commissionBps),[200,0]);assert.deepEqual(h.sales.map(s=>s.commissionSatang),[5120,0]);
});
