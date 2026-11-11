import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {LineMessageRecipient} from '@prisma/client';
import {customerLineStatus} from '../src/lib/customer-line-message';

test('LINE contact status requires recipient, matching bot and messaging token',()=>{
 const now=new Date('2026-11-11T12:00:00Z');
 const recipient:LineMessageRecipient={lineUserKey:'key',displayName:null,botId:'bot',encryptedUserId:'encrypted',updatedAt:now,friendFlag:true,friendshipAt:now,lastMessageAt:null};
 assert.equal(customerLineStatus(null,null,null,now).label,'ยังไม่ผูก LINE');
 assert.equal(customerLineStatus('key',null,null,now).label,'รออัปเดตข้อมูล LINE');
 assert.equal(customerLineStatus('key',recipient,{botId:'other',accessToken:'token'},now).ready,false);
 assert.equal(customerLineStatus('key',recipient,{botId:'bot'},now).ready,false);
 assert.equal(customerLineStatus('key',recipient,{botId:'bot',accessToken:'token'},now).ready,true);
});

test('recent direct message eligibility expires and newer unfollow prevents contact',()=>{
 const now=new Date('2026-11-11T12:00:00Z'),connection={botId:'bot',accessToken:'token'};
 const recipient:LineMessageRecipient={lineUserKey:'key',displayName:null,botId:'bot',encryptedUserId:'encrypted',updatedAt:now,friendFlag:null,friendshipAt:null,lastMessageAt:new Date(+now-86400000)};
 assert.equal(customerLineStatus('key',recipient,connection,now).ready,true);
 assert.equal(customerLineStatus('key',{...recipient,lastMessageAt:new Date(+now-7*86400000)},connection,now).ready,false);
 assert.equal(customerLineStatus('key',{...recipient,friendFlag:false,friendshipAt:now},connection,now).ready,false);
});
