import {test} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {classify,mayApprove,commissionTotal,csvCell} from "../src/lib/policy";
import {validSignature,challenge,signToken,readToken,userKey} from "../src/lib/crypto";
import {authorizationUrl,exchange} from "../src/lib/line";
process.env.SESSION_SECRET="test-only-session-key";
process.env.USER_HASH_SECRET="test-only-hash-key";
process.env.APP_URL="https://example.test";
process.env.LINE_LOGIN_CHANNEL_ID="123";
process.env.LINE_LOGIN_CHANNEL_SECRET="test-only-channel-secret";
const e={friendFlag:true,changed:true,priorFriend:false,unblocked:false,follow:true};
test("new follow + friendFlag + changed still pending: never proves lifetime first add",()=>assert.equal(classify(e).status,"PENDING_REVIEW"));
test("existing friend history excludes commission",()=>assert.equal(classify({...e,priorFriend:true}).status,"EXISTING_FRIEND"));
test("unblock excludes commission even when currently friend",()=>assert.equal(classify({...e,unblocked:true}).status,"UNBLOCKED"));
test("missing isUnblocked / missing API cannot auto approve",()=>assert.equal(classify({...e,friendFlag:null}).status,"PENDING_REVIEW"));
test("not friend excluded",()=>assert.equal(classify({...e,friendFlag:false}).status,"NOT_FRIEND"));
test("manual approval requires pending + current friend + evidence",()=>{
 assert.equal(mayApprove("PENDING_REVIEW",true,"External signed evidence reference 12345"),true);
 for(const status of ["EXISTING_FRIEND","UNBLOCKED","NOT_FRIEND","REJECTED"])assert.equal(mayApprove(status,true,"External signed evidence reference 12345"),false);
 assert.equal(mayApprove("PENDING_REVIEW",null,"External signed evidence reference 12345"),false);
 assert.equal(mayApprove("PENDING_REVIEW",true,"ok"),false);
});
test("commission uses integer satang, excludes Pending and Rejected",()=>assert.equal(commissionTotal([{status:"Approved",amountSatang:500},{status:"Paid",amountSatang:500},{status:"Pending",amountSatang:500},{status:"Rejected",amountSatang:500}]),1000));
test("100 approved at 5 baht = 500 baht",()=>assert.equal(commissionTotal(Array.from({length:100},()=>({status:"Approved",amountSatang:500}))),50000));
test("webhook validates exact raw bytes and rejects forged body",()=>{
 const raw='{"events":[]}';const sig=createHmac("sha256","secret").update(raw).digest("base64");
 assert.ok(validSignature(raw,sig,"secret"));assert.ok(!validSignature(raw+" ",sig,"secret"));assert.ok(!validSignature(raw,"bad","secret"));
});
test("session tampering rejected; stable pseudonymous identity",()=>{
 const token=signToken({id:"one"});assert.deepEqual(readToken(token),{id:"one"});assert.equal(readToken(token+"x"),null);
 assert.equal(userKey("U1"),userKey("U1"));assert.notEqual(userKey("U1"),userKey("U2"));
});
test("PKCE authorization includes state nonce add friend and S256",()=>{
 const u=new URL(authorizationUrl("state1","nonce1","verifier1"));
 for(const [k,v] of Object.entries({state:"state1",nonce:"nonce1",prompt:"consent",bot_prompt:"aggressive",code_challenge_method:"S256",scope:"openid profile",code_challenge:challenge("verifier1")}))assert.equal(u.searchParams.get(k),v);
});
test("CSV formula injection escaped incl whitespace",()=>{assert.ok(csvCell("=SUM(A1)").includes(String.fromCharCode(39)));assert.ok(csvCell("  +cmd").includes(String.fromCharCode(39)));});
test("LINE Login validates token then friendship; friendship outage fails closed",async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=(async()=>{calls++;if(calls===1)return Response.json({id_token:"id",access_token:"access"});if(calls===2)return Response.json({iss:"https://access.line.me",aud:"123",nonce:"nonce1",sub:"U1",exp:Date.now()/1000+3600});throw new Error("timeout");}) as typeof fetch;
 try{assert.deepEqual(await exchange("code","verifier","nonce1"),{userId:"U1",friendFlag:null});assert.equal(calls,3);}finally{globalThis.fetch=original;}
});
test("invalid ID token nonce rejected before friendship query",async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>Response.json(++calls===1?{id_token:"id",access_token:"access"}:{iss:"https://access.line.me",aud:"123",nonce:"wrong",sub:"U1",exp:Date.now()/1000+3600})) as typeof fetch;
 try{await assert.rejects(exchange("code","verifier","nonce1"));assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
