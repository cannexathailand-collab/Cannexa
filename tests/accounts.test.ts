import assert from "node:assert/strict";
import {test} from "node:test";
import {approvers, managers, office, roles, home, isEmployeeRole} from "../src/lib/accounts";
import {db} from "../src/lib/db";
import {report} from "../src/lib/report";

test("employee is excluded from every back-office permission group",()=>{
 for(const group of [office, managers, approvers])assert.equal(group.includes("employee"),false);
 assert.equal(approvers.includes("admin"),true);
 assert.equal(approvers.includes("manager"),false);
});

test("sales is a distinct staff role with its own-work home and no back-office privileges",()=>{
 assert.ok(roles.includes("sales"));
 for(const group of [office, managers, approvers])assert.equal(group.includes("sales"),false);
 for(const role of ["employee","sales"]){assert.equal(isEmployeeRole(role),true);assert.equal(home(role),"/my-performance");}
 for(const role of ["owner","admin","manager","viewer"]){assert.equal(isEmployeeRole(role),false);assert.equal(home(role),"/admin");}
});

test("employee report scopes the query to one affiliate and separates approved from paid",async t=>{
 const original=db.affiliate.findMany;
 t.after(()=>{db.affiliate.findMany=original;});
 db.affiliate.findMany=(async(args:Parameters<typeof original>[0])=>{
  assert.deepEqual(args?.where,{id:"staff-affiliate",code:{not:"meta-ad"}});
  return [{id:"staff-affiliate",code:"A",name:"Staff",active:true,clicks:[],conversions:[
   {friendFlag:true,status:"VERIFIED_NEW_FRIEND",commission:{status:"Approved",amountSatang:500}},
   {friendFlag:true,status:"VERIFIED_NEW_FRIEND",commission:{status:"Paid",amountSatang:200}},
   {friendFlag:true,status:"PENDING_REVIEW",commission:null},
  ]}];
 }) as unknown as typeof original;
 const [row]=await report("all","staff-affiliate");
 assert.equal(row.friends,3);
 assert.equal(row.commissionSatang-row.paidSatang,500);
 assert.equal(row.paidSatang,200);
});
