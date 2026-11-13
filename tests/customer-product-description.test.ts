import {test} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/lib/db';
import {saveCustomerProductDescription} from '../src/lib/customer-product-description';
test('customer descriptions save independently and protect against stale edits',async t=>{
 const prior=db.$transaction;t.after(()=>{db.$transaction=prior;});let row:any=null;
 const tx={$queryRawUnsafe:async()=>[],customerProductDescription:{findUnique:async()=>row,upsert:async({create,update}:any)=>{row={...(row?{...row,...update}:create),updatedAt:new Date('2026-11-13T00:00:00Z')};return row;}},auditLog:{create:async()=>({})},stockProductDescription:{upsert:async()=>{throw Error('Must not change card settings');}}};
 (db as any).$transaction=async(fn:any)=>fn(tx);
 const readSource:any=async()=>({products:[{code:'CUP01',name:'Cup'}]});
 const saved=await saveCustomerProductDescription('owner',{code:'CUP01',name:'Cup',description:'Ceramic cup.\nHand wash.',version:''},readSource);
 assert.equal(saved.description,'Ceramic cup.\nHand wash.');
 await assert.rejects(saveCustomerProductDescription('owner',{code:'CUP01',name:'Cup',description:'Stale'},readSource),/DESCRIPTION_CHANGED/);
 await assert.rejects(saveCustomerProductDescription('owner',{code:'CUP01',name:'Other',description:'Wrong'},readSource),/PRODUCT_CHANGED/);
 const next=await saveCustomerProductDescription('owner',{code:'CUP01',name:'Cup',description:'Revised description',version:saved.version},readSource);
 assert.equal(next.description,'Revised description');
});
