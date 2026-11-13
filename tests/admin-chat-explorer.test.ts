import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readableChatSources,describeChatSource,explorerWhere,exploreChatData} from '../src/lib/admin-chat-explorer';

test('business catalog spans operational modules but omits platform and authentication records',()=>{
 const names=readableChatSources().map(item=>item.source);
 for(const name of ['Customer','UserAccount','LineMessageRecipient','LineOaJob','Expense','Commission','Shipment','CrmRewardRedemption','AuditLog'])assert.ok(names.includes(name),name);
 for(const name of ['PlatformShop','PlatformAdministrator','OAuthAttempt','CustomerAccessLink'])assert.equal(names.includes(name),false);
});
test('source schemas never expose password, API secrets, sessions or binary contents',()=>{
 for(const item of readableChatSources())for(const field of describeChatSource(item.source).fields){
  assert.doesNotMatch(field.name,/password|secret|encrypted|session|nonce|verifier|salt|hash|key$/i);
  assert.ok(!['Bytes','Json'].includes(field.type));
 }
});
test('query conditions are built only from described fields and typed values',()=>{
 assert.deepEqual(explorerWhere('Customer',[{field:'name',op:'contains',value:'test'}]),{AND:[{name:{contains:'test',mode:'insensitive'}}]});
 assert.deepEqual(explorerWhere('UserAccount',[{field:'active',op:'eq',value:'true'}]),{AND:[{active:true}]});
 assert.throws(()=>explorerWhere('UserAccount',[{field:'hash',op:'eq',value:'x'}]));
 assert.throws(()=>explorerWhere('Customer',[{field:'orders.some',op:'eq',value:'x'}]));
 assert.throws(()=>explorerWhere('UserAccount',[{field:'active',op:'eq',value:'yes'}]));
 assert.throws(()=>describeChatSource('Customer; DROP TABLE Customer'));
});
test('non-owner cannot use the broad reader even if they know a source name',async()=>{
 await assert.rejects(exploreChatData('admin','list_data_sources',{}),/CHAT_FORBIDDEN/);
 await assert.rejects(exploreChatData('viewer','read_data_source',{source:'Customer'}),/CHAT_FORBIDDEN/);
});
