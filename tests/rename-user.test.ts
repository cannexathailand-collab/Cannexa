import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {renameUser} from "../src/lib/rename-user";
test("rename preserves credentials and affiliate, rotates session version and audits",async t=>{
 const original=db.$transaction;t.after(()=>{db.$transaction=original;});
 const account={username:"old-name",role:"employee",hash:"hash",salt:"salt",affiliateId:"affiliate",active:true,version:"old"};let audit:any;
 db.$transaction=(async(fn:any)=>fn({orderIntake:{updateMany:async({where,data}:any)=>{assert.equal(where.sellerUsername,"old-name");assert.equal(data.sellerUsername,"new-name");return {count:1};}},userAccount:{findUnique:async({where}:any)=>where.username===account.username?account:null,update:async({data}:any)=>Object.assign(account,data)},auditLog:{create:async({data}:any)=>{audit=data;}}})) as any;
 await renameUser("old-name"," New-Name ","owner");assert.equal(account.username,"new-name");assert.notEqual(account.version,"old");assert.equal(account.hash,"hash");assert.equal(account.affiliateId,"affiliate");assert.deepEqual(audit.details,{previousUsername:"old-name",username:"new-name"});
});
test("rename rejects existing usernames without mutating accounts",async t=>{
 const original=db.$transaction;t.after(()=>{db.$transaction=original;});
 db.$transaction=(async(fn:any)=>fn({userAccount:{findUnique:async()=>({username:"exists",role:"employee"}),update:async()=>assert.fail("must not update")}})) as any;
 await assert.rejects(renameUser("old-name","exists","owner"),{message:"USERNAME_EXISTS"});
});
test("reserved owner, malformed names and actor rename are rejected",async()=>{
 for(const [old,next,actor] of [["owner","new","owner"],["staff","owner","owner"],["staff","x","owner"],["staff","bad name","owner"],["staff","new","staff"]])await assert.rejects(renameUser(old,next,actor));
});
