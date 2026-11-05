import {test} from "node:test";
import assert from "node:assert/strict";
import {db} from "../src/lib/db";
import {encryptGmail} from "../src/lib/gmail";
import {importGmailReports} from "../src/lib/gmail-reports";
process.env.SESSION_SECRET="deleted-message-test-only";
test("history entries for deleted messages are skipped without blocking later messages",async t=>{
 const originals={fetch:globalThis.fetch,find:db.gmailConnection.findUnique,update:db.gmailConnection.updateMany};t.after(()=>{globalThis.fetch=originals.fetch;db.gmailConnection.findUnique=originals.find;db.gmailConnection.updateMany=originals.update;});
 db.gmailConnection.findUnique=(async()=>({encryptedConfig:encryptGmail({clientId:"test.apps.googleusercontent.com",clientSecret:"secret"}),encryptedToken:encryptGmail({refreshToken:"refresh"}),revision:"revision",email:"test@example.com"})) as any;
 let updated=false;db.gmailConnection.updateMany=(async()=>{updated=true;return {count:1};}) as any;
 const calls:string[]=[];
 globalThis.fetch=async input=>{const url=String(input);calls.push(url);if(url.includes("oauth2.googleapis.com"))return Response.json({access_token:"token"});if(url.includes("deleted"))return new Response("Not found",{status:404});return Response.json({payload:{headers:[{name:"From",value:"other@example.com"}]}});};
 const result=await importGmailReports("test",["deleted","next-message"]);
 assert.equal(result.imported,0);assert.ok(calls.some(u=>u.includes("next-message")));assert.equal(updated,true);
});
