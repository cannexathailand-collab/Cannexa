import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Prisma} from '@prisma/client';
import {customerIdentity,resolveOrderCustomer} from '../src/lib/order-customer';

test('explicit customer code accepts different delivery contacts without changing the customer',async()=>{
 const customer={code:'CUS-00000001',name:'Original buyer',phone:'0812345678',identityKey:customerIdentity('Original buyer','0812345678')};
 const queries:unknown[]=[];
 const tx={customer:{findUnique:async(query:unknown)=>{queries.push(query);return customer;}}} as unknown as Prisma.TransactionClient;
 const result=await resolveOrderCustomer(tx,{code:' c0001 ',name:'Different recipient',phone:'0899999999',sellerId:'seller'});
 assert.equal(result,customer);
 assert.deepEqual(queries,[{where:{code:'CUS-00000001'}}]);
 assert.equal(customer.name,'Original buyer');
 assert.equal(customer.phone,'0812345678');
});

test('unknown explicit customer code stays unresolved instead of creating a customer',async()=>{
 const tx={customer:{findUnique:async()=>null}} as unknown as Prisma.TransactionClient;
 assert.equal(await resolveOrderCustomer(tx,{code:'C0002',name:'Buyer',phone:'0812345678',sellerId:'seller'}),null);
});

test('orders without a customer code resolve contact without assigning the seller as referrer',async()=>{
 let query:unknown;
 const tx={customer:{upsert:async(input:unknown)=>{query=input;return {code:'CUS-00000003'};}}} as unknown as Prisma.TransactionClient;
 await resolveOrderCustomer(tx,{name:'Buyer',phone:'0812345678',sellerId:'seller'});
 assert.deepEqual(query,{where:{identityKey:customerIdentity('Buyer','0812345678')},create:{identityKey:customerIdentity('Buyer','0812345678'),name:'Buyer',phone:'0812345678'},update:{}});
});
