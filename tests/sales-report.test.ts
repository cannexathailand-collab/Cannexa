import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {summarizeSales,salesReport,type SaleRow} from "../src/lib/sales-report";
const row=(id:string,values:Record<string,unknown>={}):SaleRow=>({id,orderId:id,affiliateId:"affiliate",paymentMethod:"TRANSFER",status:"PENDING",revenueSatang:10000,commissionSatang:200,paidAmountSatang:null,createdAt:new Date("2026-11-05"),order:{id,orderNumber:id,sellerUsername:"ink123",sellerCode:"Ink123",payment:"โอน",status:"TRANSFER_RECORDED"},affiliate:{id:"affiliate",name:"Affiliate",code:"11155"},...values}) as SaleRow;
test("sales totals exclude cancelled returned and claim rows and retain pending cost sales",()=>{
 const result=summarizeSales([row("transfer"),row("cod",{paymentMethod:"COD",status:"PAID",revenueSatang:20000,commissionSatang:400,paidAmountSatang:500}),row("cost",{paymentMethod:"COD",status:"WAITING_COST",revenueSatang:30000,commissionSatang:null}),row("cancelled",{status:"CANCELLED"}),row("claim",{order:{payment:"เคลม",status:"CLAIM_WAITING_COST"}}),row("returned",{order:{payment:"COD",status:"RETURNED"}})]);
 assert.equal(result.count,3);assert.equal(result.revenueSatang,60000);assert.equal(result.transferSatang,10000);assert.equal(result.codSatang,50000);assert.equal(result.pendingCommissionSatang,200);assert.equal(result.paidCommissionSatang,500);assert.equal(result.waitingCost,1);
});
test("paid historical sales survive removal of LINE text while cancelled sales remain excluded",()=>{
 const result=summarizeSales([row("paid",{order:null,status:"PAID"}),row("cancelled",{order:null,status:"CANCELLED"})]);assert.equal(result.count,1);assert.equal(result.revenueSatang,10000);
});
test("month report keeps two employee accounts of a shared affiliate separate",async t=>{
 const original={sales:db.salesOrder.findMany,orders:db.orderIntake.findMany,affiliates:db.affiliate.findMany};t.after(()=>{db.salesOrder.findMany=original.sales;db.orderIntake.findMany=original.orders;db.affiliate.findMany=original.affiliates;});
 db.salesOrder.findMany=(async({where}:any)=>{assert.deepEqual(where.status.in,["PENDING","PAID","WAITING_COST"]);return [row("ink"),row("ploy"),row("old",{createdAt:new Date("2026-10-05")})];}) as any;
 db.orderIntake.findMany=(async({where}:any)=>{assert.deepEqual(where.id.in,["ink","ploy"]);return [row("ink").order,{...row("ploy").order,sellerUsername:"ploysai"}];}) as any;
 db.affiliate.findMany=(async()=>[{id:"affiliate",name:"Affiliate",code:"11155"}]) as any;
 const result=await salesReport("2026-11");assert.equal(result.summary.count,2);assert.equal(result.summary.revenueSatang,20000);assert.deepEqual(result.groups.map(g=>g.name).sort(),["ink123","ploysai"]);
});
