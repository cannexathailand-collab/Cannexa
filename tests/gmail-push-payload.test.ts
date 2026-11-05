import {test} from "node:test";
import assert from "node:assert/strict";
import {decodeGmailPush} from "../src/lib/gmail-push-payload";
test("wrapped Gmail notification supports text history IDs without depending on PubSub ID casing",()=>{const data={emailAddress:"test@example.com",historyId:"1234567890"};assert.deepEqual(decodeGmailPush(JSON.stringify({message:{message_id:"provider-id",data:Buffer.from(JSON.stringify(data)).toString("base64")}})),data);});
test("unwrapped notifications and safe numeric history IDs normalize consistently",()=>{assert.deepEqual(decodeGmailPush(JSON.stringify({emailAddress:"test@example.com",historyId:1234567890})),{emailAddress:"test@example.com",historyId:"1234567890"});});
test("unrelated PubSub messages and invalid mailbox fields are rejected",()=>{for(const data of ["{}",'{"message":{"data":"garbage"}}','{"emailAddress":"invalid","historyId":"1"}','{"emailAddress":"test@example.com","historyId":-1}'])assert.throws(()=>decodeGmailPush(data));});
