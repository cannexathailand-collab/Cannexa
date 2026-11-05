import {test,afterEach} from "node:test";
import assert from "node:assert/strict";
import {getOrderBotInfo} from "../src/lib/order-bot-info";
const original=globalThis.fetch;afterEach(()=>{globalThis.fetch=original;});
test("bot lookup reads identity from LINE using a bearer token",async()=>{
 globalThis.fetch=async(input,options)=>{assert.equal(input,"https://api.line.me/v2/bot/info");assert.equal((options?.headers as Record<string,string>).Authorization,"Bearer test-token");assert.equal(options?.cache,"no-store");return Response.json({userId:"U"+"1".repeat(32),displayName:"Test OA",basicId:"@example"});};
 assert.equal((await getOrderBotInfo("test-token")).userId,"U"+"1".repeat(32));
});
test("invalid tokens never expose LINE error bodies",async()=>{
 globalThis.fetch=async()=>new Response("private provider response",{status:401});await assert.rejects(getOrderBotInfo("bad-token"),{message:"INVALID_TOKEN"});
 await assert.rejects(getOrderBotInfo("bad token"),{message:"INVALID_TOKEN"});
});
test("bad identity and provider outage are rejected",async()=>{
 globalThis.fetch=async()=>Response.json({userId:"@basic",displayName:"Test",basicId:"@basic"});await assert.rejects(getOrderBotInfo("token"),{message:"INVALID_BOT_RESPONSE"});
 globalThis.fetch=async()=>{throw new Error("network");};await assert.rejects(getOrderBotInfo("token"),{message:"LINE_UNAVAILABLE"});
});
