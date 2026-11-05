import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {employeeOrders} from "../src/lib/employee-orders";
test("employee orders require both own affiliate and account, and commission query stays scoped",async t=>{
 const original={orders:db.orderIntake.findMany,sales:db.salesOrder.findMany};t.after(()=>{db.orderIntake.findMany=original.orders;db.salesOrder.findMany=original.sales;});
 db.orderIntake.findMany=(async({where,take}:any)=>{assert.equal(where.affiliateId,"shared");assert.equal(where.sellerUsername,"ink123");assert.deepEqual(where.status.notIn,["WITHDRAWN","CANCELLED"]);assert.equal(where.createdAt.gte.toISOString(),"2026-08-31T17:00:00.000Z");assert.equal(where.createdAt.lt.toISOString(),"2026-09-30T17:00:00.000Z");assert.equal(take,100);return [{id:"own-order"}];}) as any;
 db.salesOrder.findMany=(async({where}:any)=>{assert.deepEqual(where,{affiliateId:"shared",orderId:{in:["own-order"]}});return [{orderId:"own-order",status:"PAID",commissionSatang:6600}];}) as any;
 const result=await employeeOrders("shared","ink123","2026-09");assert.equal(result.sales[0].status,"PAID");assert.equal(result.orders.length,1);
});
test("unlinked employee never queries orders",async t=>{
 const original=db.orderIntake.findMany;t.after(()=>{db.orderIntake.findMany=original;});db.orderIntake.findMany=(async()=>assert.fail("Must not query all orders")) as any;
 assert.deepEqual(await employeeOrders(null,"employee","2026-11"),{orders:[],sales:[]});
 await assert.rejects(()=>employeeOrders("affiliate","employee","bad-month"));
});
