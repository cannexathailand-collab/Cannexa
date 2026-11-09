import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db} from '../src/lib/db';
import {changeOrder,orderEditVersion} from '../src/lib/order-changes';
const original=db.$transaction;
afterEach(()=>{db.$transaction=original;});
test('seller ownership is rechecked inside the order change transaction',async()=>{
 const order={id:'order',messageKey:'message',rawText:'text',status:'WAITING_SHIPMENT',sellerUsername:'other-seller'};
 const tx:any={$queryRawUnsafe:async()=>[],auditLog:{findUnique:async()=>null},orderIntake:{findUniqueOrThrow:async()=>order}};
 db.$transaction=(async(fn:any)=>fn(tx)) as any;
 await assert.rejects(changeOrder('seller',{id:'order',requestKey:randomUUID(),expectedVersion:orderEditVersion(order),action:'CANCEL'},undefined,{sellerUsername:'seller'}),/เฉพาะออเดอร์ที่คุณเป็นผู้ขาย/);
});
