import {test,mock,afterEach} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {recordLogin,webhook,review} from "../src/lib/tracking";
import {GET as scan} from "../src/app/r/[code]/route";
import {NextRequest} from "next/server";
import QRCode from "qrcode";
process.env.MOCK_MODE="true";process.env.APP_URL="http://localhost:3000";
type Row=Record<string,any>;
const originalTx=db.$transaction,originalFind=db.trackingLink.findFirst,originalCreate=db.click.create;
afterEach(()=>{db.$transaction=originalTx;db.trackingLink.findFirst=originalFind;db.click.create=originalCreate;});
function harness(){
 const clicks:Row[]=[
 {id:"click-a",affiliateId:"affiliate-a",source:"MOCK",createdAt:new Date(Date.now()-60000),affiliate:{active:true,rateSatang:500}},
 {id:"click-b",affiliateId:"affiliate-b",source:"MOCK",createdAt:new Date(Date.now()-30000),affiliate:{active:true,rateSatang:900}}
 ];
 const conversions:Row[]=[],events:Row[]=[],audits:Row[]=[],commissions:Row[]=[];
 const tx:any={
 $queryRawUnsafe:async()=>[],
 click:{findUniqueOrThrow:async({where}:Row)=>clicks.find(c=>c.id===where.id),update:async({where,data}:Row)=>Object.assign(clicks.find(c=>c.id===where.id)!,data)},
 conversion:{
 findUnique:async({where,include}:Row)=>{const c=conversions.find(c=>c.userKey===where.userKey);return c?(include?{...c,affiliate:clicks.find(x=>x.id===c.clickId)?.affiliate,click:clicks.find(x=>x.id===c.clickId),commission:commissions.find(x=>x.conversionId===c.id)??null}:c):null;},
 findUniqueOrThrow:async({where}:Row)=>{const c=conversions.find(c=>c.id===where.id)!;return {...c,click:clicks.find(x=>x.id===c.clickId),affiliate:{active:true},commission:commissions.find(x=>x.conversionId===c.id)??null};},
 create:async({data}:Row)=>{assert.ok(!conversions.some(c=>c.userKey===data.userKey),"unique user");const c={...data,id:"conversion-"+conversions.length,createdAt:new Date()};conversions.push(c);return c;},
 update:async({where,data}:Row)=>Object.assign(conversions.find(c=>c.id===where.id)!,data)
 },
 webhookEvent:{findUnique:async({where}:Row)=>events.find(e=>e.id===where.id)??null,findMany:async({where}:Row)=>events.filter(e=>e.userKey===where.userKey),create:async({data}:Row)=>{events.push(data);return data;}},
 commission:{create:async({data}:Row)=>{commissions.push({...data,id:"commission-"+commissions.length});},upsert:async({where,create,update}:Row)=>{let c=commissions.find(x=>x.conversionId===where.conversionId);if(c)Object.assign(c,update);else{c={...create,id:"commission-"+commissions.length};commissions.push(c!);}return c;},update:async({where,data}:Row)=>Object.assign(commissions.find(c=>c.id===where.id||c.conversionId===where.conversionId)!,data)},
 auditLog:{create:async({data}:Row)=>{audits.push(data);return data;}},
 rateLimit:{upsert:async()=>({count:1,expiresAt:new Date(Date.now()+60000)})}
 };
 db.$transaction=(async(fn:any)=>fn(tx)) as typeof db.$transaction;
 return {tx,clicks,conversions,events,audits,commissions};
}
test("scan coupon creates click and OAuth session then redirects to explicit MOCK",async()=>{
 const h=harness();let captured:Row={};
 db.trackingLink.findFirst=(async()=>({id:"link-a",affiliateId:"affiliate-a",affiliate:{active:true}})) as any;
 db.click.create=(async({data}:any)=>{captured=data;return {id:"new-click"};}) as any;
 try{const r=await scan(new NextRequest("http://localhost:3000/r/AFF001"),{params:Promise.resolve({code:"AFF001"})});assert.equal(r.status,307);assert.ok(r.headers.get("location")?.includes("/mock?state="));assert.ok(r.headers.get("set-cookie")?.includes("HttpOnly"));assert.equal(captured.source,"MOCK");assert.equal(captured.affiliateId,"affiliate-a");assert.equal(captured.oauth.create.verifier.length,43);}finally{mock.restoreAll();}
});
test("QR PNG is generated from tracking link",async()=>{const png=await QRCode.toBuffer("https://example.test/r/AFF001");assert.equal(png.subarray(1,4).toString(),"PNG");});
test("new friend candidate stays Pending without creating commission",async()=>{
 const h=harness();try{const c=await recordLogin("click-a","U1",true,true);assert.equal(c.status,"PENDING_REVIEW");assert.equal(h.commissions.length,0);}finally{mock.restoreAll();}
});
test("same user visits multiple affiliates: first authenticated touch wins, rate snapshot retained",async()=>{
 const h=harness();try{const a=await recordLogin("click-a","U1",true,true);const b=await recordLogin("click-b","U1",true,true);assert.equal(a.id,b.id);assert.equal(b.affiliateId,"affiliate-a");assert.equal(b.rateSatang,500);assert.equal(h.conversions.length,1);}finally{mock.restoreAll();}
});
test("returning identical LINE user never generates another conversion or commission",async()=>{
 const h=harness();try{for(let i=0;i<4;i++)await recordLogin("click-a","U1",true,true);assert.equal(h.conversions.length,1);assert.equal(h.commissions.length,0);}finally{mock.restoreAll();}
});
test("prior follow event identifies existing friend",async()=>{
 const h=harness();try{await webhook({id:"e1",key:"U1",type:"follow",at:new Date(Date.now()-86400000),unblocked:false});assert.equal((await recordLogin("click-a","U1",true,false)).status,"EXISTING_FRIEND");}finally{mock.restoreAll();}
});
test("unblock event cannot become new-friend commission",async()=>{
 const h=harness();try{await webhook({id:"e1",key:"U1",type:"follow",at:new Date(),unblocked:true});const c=await recordLogin("click-a","U1",true,true);assert.equal(c.status,"UNBLOCKED");await assert.rejects(review(c.id,"approve","External evidence not sufficient for unblock"));assert.equal(h.commissions.length,0);}finally{mock.restoreAll();}
});
test("duplicate webhook delivery creates one event",async()=>{
 const h=harness();try{const e={id:"same-event",key:"U1",type:"follow",at:new Date(),unblocked:null};await webhook(e);await webhook(e);assert.equal(h.events.length,1);}finally{mock.restoreAll();}
});
test("API outage cannot approve; later scan can recheck without losing attribution",async()=>{
 const h=harness();try{const c=await recordLogin("click-a","U1",null,null);await assert.rejects(review(c.id,"approve","External evidence document for this person"));const again=await recordLogin("click-b","U1",true,true);assert.equal(again.friendFlag,true);assert.equal(again.status,"PENDING_REVIEW");assert.equal(again.affiliateId,"affiliate-a");assert.equal(h.conversions.length,1);}finally{mock.restoreAll();}
});
test("automatic verification and paid retries idempotent; amount frozen and all changes audited",async()=>{
 const h=harness();try{
 const c=await recordLogin("click-a","U1",true,true);const reason="External reviewed evidence document REF-000001";
 await webhook({id:"verified",key:"U1",type:"follow",at:new Date(h.clicks[0].loginAt.getTime()-1),unblocked:false});
 await assert.rejects(review(c.id,"approve",reason));
 assert.equal(h.commissions.length,1);assert.equal(h.commissions[0].amountSatang,500);
 await review(c.id,"paid",reason);await review(c.id,"paid",reason);
 assert.equal(h.commissions[0].status,"Paid");assert.equal(h.audits.length,1);
 await assert.rejects(review(c.id,"reject",reason));
 }finally{mock.restoreAll();}
});
test("late historical follow revokes unpaid approval and appends audit",async()=>{
 const h=harness();try{const c=await recordLogin("click-a","U1",true,true);await webhook({id:"verified",key:"U1",type:"follow",at:new Date(h.clicks[0].loginAt.getTime()-1),unblocked:false});await webhook({id:"delayed",key:"U1",type:"follow",at:new Date(Date.now()-86400000),unblocked:false});assert.equal(h.commissions[0].status,"Rejected");assert.equal(h.conversions[0].status,"EXISTING_FRIEND");assert.equal(h.audits.at(-1)!.action,"COMMISSION_REVOKED");}finally{mock.restoreAll();}
});

test("unblock after initial login cannot leave a candidate eligible for approval",async()=>{
 const h=harness();try{
 const c=await recordLogin("click-a","U2",true,true);
 await webhook({id:"new-unblock",key:"U2",type:"follow",at:new Date(c.createdAt.getTime()+1000),unblocked:true});
 assert.equal(h.conversions[0].status,"UNBLOCKED");
 await assert.rejects(review(c.id,"approve","External evidence document REF-000002"));
 }finally{mock.restoreAll();}
});
test("unfollow after login blocks approval of stale friendFlag",async()=>{
 const h=harness();try{
 const c=await recordLogin("click-a","U3",true,true);
 await webhook({id:"new-block",key:"U3",type:"unfollow",at:new Date(c.createdAt.getTime()+1000),unblocked:null});
 await assert.rejects(review(c.id,"approve","External evidence document REF-000003"));
 assert.equal(h.commissions.length,0);
 }finally{mock.restoreAll();}
});
test("rechecking cannot ignore unblock evidence newer than first conversion",async()=>{
 const h=harness();try{
 const c=await recordLogin("click-a","U4",null,null);
 h.events.push({id:"later-unblock",userKey:"U4",type:"follow",eventAt:new Date(c.createdAt.getTime()+1000),isUnblocked:true});
 const again=await recordLogin("click-b","U4",true,true);
 assert.equal(again.status,"UNBLOCKED");
 }finally{mock.restoreAll();}
});

test("block after approval does not silently revoke an already earned commission",async()=>{
 const h=harness();try{
 const c=await recordLogin("click-a","U5",true,true);
 await webhook({id:"verified",key:"U5",type:"follow",at:new Date(h.clicks[0].loginAt.getTime()-1),unblocked:false});
 await webhook({id:"post-approval-block",key:"U5",type:"unfollow",at:new Date(c.createdAt.getTime()+1000),unblocked:null});
 assert.equal(h.commissions[0].status,"Approved");
 assert.equal(h.conversions[0].status,"VERIFIED_NEW_FRIEND");
 }finally{mock.restoreAll();}
});

test("unconfigured real LINE flow returns 503 before creating a click",async()=>{
 const keys=["MOCK_MODE","LINE_LOGIN_CHANNEL_ID","LINE_LOGIN_CHANNEL_SECRET","LINE_MESSAGING_CHANNEL_SECRET","LINE_BOT_USER_ID","LINE_OA_BASIC_ID"];
 const originalConnection=db.lineConnection.findUnique;
 db.lineConnection.findUnique=(async()=>null) as any;
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  for(const k of keys)delete process.env[k];
  process.env.MOCK_MODE="false";
  const response=await scan(new NextRequest("http://localhost:3000/r/AFF001"),{params:Promise.resolve({code:"AFF001"})});
  assert.equal(response.status,503);
  assert.ok((await response.text()).includes("LINE OA"));
 }finally{db.lineConnection.findUnique=originalConnection;for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
});

test("Meta ad friend is verified without creating employee commission",async()=>{
 const h=harness();
 h.clicks[0].affiliate.code="meta-ad";
 await recordLogin("click-a","ad-user",true,true);
 await webhook({id:"ad-follow",key:"ad-user",type:"follow",at:new Date(h.clicks[0].loginAt.getTime()-1),unblocked:false});
 assert.equal(h.conversions[0].status,"VERIFIED_NEW_FRIEND");
 assert.equal(h.commissions.length,0);
});
test("friend rate changes affect only new conversions, including approval delayed until after the change",async()=>{
 const h=harness();await recordLogin("click-a","old-rate-user",true,true);h.clicks[0].affiliate.rateSatang=100;
 await recordLogin("click-a","new-rate-user",true,true);
 for(const [id,key] of [["old-rate-follow","old-rate-user"],["new-rate-follow","new-rate-user"]])await webhook({id,key,type:"follow",at:new Date(h.clicks[0].loginAt.getTime()-1),unblocked:false});
 assert.deepEqual(h.conversions.map(c=>c.rateSatang),[500,100]);assert.deepEqual(h.commissions.map(c=>c.amountSatang),[500,100]);
 await review(h.conversions[0].id,"paid","Rate snapshot verification test evidence");h.clicks[0].affiliate.rateSatang=900;await recordLogin("click-a","raised-rate-user",true,true);await webhook({id:"raised-follow",key:"raised-rate-user",type:"follow",at:new Date(h.clicks[0].loginAt.getTime()-1),unblocked:false});
 assert.deepEqual(h.commissions.map(c=>c.amountSatang),[500,100,900]);assert.equal(h.commissions[0].status,"Paid");
});
