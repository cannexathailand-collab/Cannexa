import assert from 'node:assert/strict';
import {test} from 'node:test';
import {db} from '../src/lib/db';
import {createCustomerAccessLink} from '../src/lib/customer-access-link';
import {sha} from '../src/lib/crypto';

test('personal linking URL stores a hash and expires after 24 hours',async context=>{
 process.env.APP_URL??='https://example.test';
 const original=db.$transaction;context.after(()=>{db.$transaction=original;});
 let saved:any;
 const tx={$queryRawUnsafe:async()=>[],customer:{findUnique:async()=>({lineUserKey:null,profileResetAt:null,portalProfileIncomplete:false})},customerAccessLink:{deleteMany:async()=>{},create:async({data}:any)=>{saved=data;}},auditLog:{create:async()=>{}}};
 db.$transaction=((work:any)=>work(tx)) as typeof original;
 const before=Date.now(),result=await createCustomerAccessLink('C0001','employee');
 const token=new URL(result.url).searchParams.get('link')!;assert.ok(token);assert.equal(saved.tokenHash,sha(token));assert.equal(saved.customerCode,'CUS-00000001');
 assert.ok(+saved.expiresAt>=before+86400000);assert.equal(saved.createdBy,'employee');
});

test('link generation rejects a linked or deleted customer inside its write transaction',async context=>{
 const original=db.$transaction;context.after(()=>{db.$transaction=original;});
 let customer:any={lineUserKey:'existing',profileResetAt:null,portalProfileIncomplete:false};
 db.$transaction=((work:any)=>work({$queryRawUnsafe:async()=>[],customer:{findUnique:async()=>customer}})) as typeof original;
 await assert.rejects(createCustomerAccessLink('C0001','employee'),/ALREADY_LINKED/);
 customer={lineUserKey:null,profileResetAt:new Date(),portalProfileIncomplete:true};await assert.rejects(createCustomerAccessLink('C0001','employee'),/CUSTOMER_NOT_FOUND/);
});
