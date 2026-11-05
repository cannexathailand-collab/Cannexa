import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {orderReview} from "../src/lib/order-review";
import {needsOrderReview} from "../src/lib/order-review-state";
test("pending orders offer review while completed and returned orders do not",()=>{
 for(const status of ["WAITING_SHIPMENT","NEEDS_REVIEW","MATCHED_SHIPMENT_WAITING_COD","COD_AMOUNT_MISMATCH","CLAIM_WAITING_COST"])assert.equal(needsOrderReview({status,payment:"COD"}),true);
 for(const status of ["RETURNED","CANCELLED","WITHDRAWN","EXPIRED","MATCHED_SHIPMENT"])assert.equal(needsOrderReview({status,payment:"COD"},{status:"PAID"},"TRACK"),false);
 assert.equal(needsOrderReview({status:"TRANSFER_RECORDED",payment:"โอน"},{status:"PAID"}),true);
});
test("employee review requires both account and affiliate, and reveals no unrelated parcel candidates",async t=>{
 const original={order:db.orderIntake.findFirst,sale:db.salesOrder.findUnique,shipment:db.shipment.findUnique,receipt:db.codReceipt.findUnique,candidates:db.shipment.findMany};
 t.after(()=>{db.orderIntake.findFirst=original.order;db.salesOrder.findUnique=original.sale;db.shipment.findUnique=original.shipment;db.codReceipt.findUnique=original.receipt;db.shipment.findMany=original.candidates;});
 db.orderIntake.findFirst=(async({where}:any)=>{assert.equal(where.id,"own");assert.equal(where.sellerUsername,"ink123");assert.equal(where.affiliateId,"shared");return {id:"own",affiliateId:"shared",sellerUsername:"ink123",status:"MATCHED_SHIPMENT_WAITING_COD",payment:"COD",phone:"0812345678",recipient:"ทดสอบ",rawText:"ยอดรวม: 100",issues:[]};}) as any;
 db.salesOrder.findUnique=(async()=>null) as any;db.shipment.findUnique=(async()=>({orderId:"own",tracking:"OWNTRACK",codSatang:10000})) as any;db.codReceipt.findUnique=(async()=>null) as any;db.shipment.findMany=(async()=>assert.fail("Employee must not query parcel candidates")) as any;
 const data=await orderReview("own",{role:"employee",username:"ink123",affiliateId:"shared"});assert.ok(data);assert.equal(data.canSeeCandidates,false);assert.deepEqual(data.candidates,[]);assert.ok(data.reasons.some(r=>r.includes("รอรายงานรับเงิน COD")));
});
test("missing or unauthorized order stops before reading shipment and commission data",async t=>{
 const original={order:db.orderIntake.findFirst,sale:db.salesOrder.findUnique};t.after(()=>{db.orderIntake.findFirst=original.order;db.salesOrder.findUnique=original.sale;});
 db.orderIntake.findFirst=(async()=>null) as any;db.salesOrder.findUnique=(async()=>assert.fail("Must not read another order")) as any;
 assert.equal(await orderReview("other",{role:"employee",username:"employee",affiliateId:"affiliate"}),null);
 db.orderIntake.findFirst=(async()=>assert.fail("Unlinked employee must not query orders")) as any;
 assert.equal(await orderReview("other",{role:"employee",username:"employee",affiliateId:null}),null);
});
