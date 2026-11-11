import assert from 'node:assert/strict';
import {test} from 'node:test';
import {db} from '../src/lib/db';
import {verifiedLineFriendship} from '../src/lib/line-friendship';
import {exchange} from '../src/lib/line';

test('explicit friendship API results take priority over historical evidence',async context=>{
 const original=db.webhookEvent.findFirst;context.after(()=>{db.webhookEvent.findFirst=original;});
 db.webhookEvent.findFirst=(async()=>{assert.fail('history must not override current API result');}) as typeof original;
 assert.equal(await verifiedLineFriendship('key',true),true);
 assert.equal(await verifiedLineFriendship('key',false),false);
});

test('friendship failure retains a safe status code while successful LINE identity remains valid',async context=>{
 const original=globalThis.fetch;context.after(()=>{globalThis.fetch=original;});
 process.env.APP_URL??='https://example.test';
 globalThis.fetch=(async url=>{
  if(String(url).endsWith('/token'))return Response.json({id_token:'test',access_token:'private-token'});
  if(String(url).endsWith('/verify'))return Response.json({iss:'https://access.line.me',aud:'test-login',nonce:'nonce',sub:'test-user',exp:Math.floor(Date.now()/1000)+600});
  return new Response('private upstream error',{status:400});
 }) as typeof fetch;
 const result=await exchange('code','verifier','nonce',{loginId:'test-login',loginSecret:'secret',messagingSecret:'secret',botId:'bot',basicId:'@bot'});
 assert.equal(result.userId,'test-user');assert.equal(result.friendFlag,null);assert.equal(result.friendshipError,'HTTP_400');
});

test('unavailable friendship API uses the latest verified follow or unfollow for the same identity',async context=>{
 const original=db.webhookEvent.findFirst;context.after(()=>{db.webhookEvent.findFirst=original;});
 const originalRecipient=db.lineMessageRecipient.findUnique;context.after(()=>{db.lineMessageRecipient.findUnique=originalRecipient;});
 let saved:{friendFlag:boolean;friendshipAt:Date}|null=null;
 db.lineMessageRecipient.findUnique=(async()=>saved) as typeof originalRecipient;
 const at=new Date();let latest:{type:string;eventAt:Date}|null={type:'follow',eventAt:at};
 db.webhookEvent.findFirst=(async({where,orderBy}:any)=>{assert.equal(where.userKey,'key');assert.deepEqual(where.type.in,['follow','unfollow']);assert.deepEqual(orderBy,[{eventAt:'desc'},{receivedAt:'desc'}]);return latest;}) as typeof original;
 assert.equal(await verifiedLineFriendship('key',null),true);
 saved={friendFlag:false,friendshipAt:new Date(+at+1000)};assert.equal(await verifiedLineFriendship('key',null),false);saved=null;
 latest={type:'unfollow',eventAt:at};assert.equal(await verifiedLineFriendship('key',null),false);
 latest=null;assert.equal(await verifiedLineFriendship('key',null),null);
});
