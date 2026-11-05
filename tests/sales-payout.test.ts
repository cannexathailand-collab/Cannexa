import {test,afterEach} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {markAffiliatePaid} from "../src/lib/commission-payment";
import {reverseOrderSales} from "../src/lib/sales-cancellation";
const original=db.$transaction;
afterEach(()=>{db.$transaction=original;});
function setup(){
 const sales:any[]=[{id:"s1",orderId:"o1",affiliateId:"a",status:"PENDING",commissionSatang:1000}];
 const audits:any[]=[];
 const tx:any={$queryRawUnsafe:async()=>[],commission:{findMany:async()=>[],updateMany:async()=>({count:0})},salesOrder:{findMany:async({where}:any)=>sales.filter(s=>where.id?where.id.in.includes(s.id):where.orderId.in.includes(s.orderId)&&s.status!=="CANCELLED"),updateMany:async({where,data}:any)=>{const selected=sales.filter(s=>s.id===where.id&&s.status===where.status&&s.commissionSatang===where.commissionSatang);selected.forEach(s=>Object.assign(s,data));return {count:selected.length};},update:async({where,data}:any)=>Object.assign(sales.find(s=>s.id===where.id),data)},auditLog:{create:async({data}:any)=>audits.push(data)}};
 db.$transaction=(async(fn:any)=>fn(tx)) as any;
 return {sales,audits,tx};
}
test("sales commission payout records amount once and preserves paid commission on cancellation",async()=>{
 const h=setup();await markAffiliatePaid(["sale:s1"],"owner");await markAffiliatePaid(["sale:s1"],"owner");
 assert.equal(h.audits.length,1);assert.equal(h.sales[0].paidAmountSatang,1000);
 await reverseOrderSales(h.tx,["o1"]);assert.equal(h.sales[0].status,"PAID");assert.equal(h.sales[0].commissionSatang,1000);
});
test("cancelled pending commission cannot be paid from a stale payout page",async()=>{
 const h=setup();await reverseOrderSales(h.tx,["o1"]);assert.equal(h.sales[0].commissionSatang,0);
 await assert.rejects(()=>markAffiliatePaid(["sale:s1"],"owner"));assert.equal(h.audits.length,0);
});
test("one payout cannot combine two affiliates",async()=>{
 const h=setup();h.sales.push({...h.sales[0],id:"s2",affiliateId:"b"});
 await assert.rejects(()=>markAffiliatePaid(["sale:s1","sale:s2"],"owner"));assert.equal(h.sales[0].status,"PENDING");
});

test("friend payout captures its actual payment date once so only paid commissions become expenses",async()=>{
 const h=setup();const friend:any={id:"f1",status:"Approved",amountSatang:500,conversion:{affiliateId:"a",source:"LINE",status:"VERIFIED_NEW_FRIEND"}};
 h.tx.commission.findMany=async()=>[friend];h.tx.commission.updateMany=async({where,data}:any)=>{if(where.id.in.includes(friend.id)&&friend.status===where.status){Object.assign(friend,data);return {count:1};}return {count:0};};
 await markAffiliatePaid(["friend:f1"],"owner");assert.ok(friend.paidAt instanceof Date);const at=friend.paidAt.getTime();await markAffiliatePaid(["friend:f1"],"owner");assert.equal(friend.paidAt.getTime(),at);assert.equal(h.audits.length,1);assert.equal(friend.amountSatang,500);
});
