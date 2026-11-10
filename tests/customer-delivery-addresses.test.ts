import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Prisma} from '@prisma/client';
import {saveCustomerDeliveryAddresses} from '../src/lib/customer-delivery-addresses';

test('address history preserves an earlier delivery phone and stores the selected phone separately',async()=>{
 const calls:Prisma.CustomerDeliveryAddressUpsertArgs[]=[];
 const tx={customerDeliveryAddress:{upsert:async(input:Prisma.CustomerDeliveryAddressUpsertArgs)=>{calls.push(input);}}} as unknown as Prisma.TransactionClient;
 await saveCustomerDeliveryAddresses(tx,'C0001',[
  {name:'Previous recipient',address:'Previous address 10110',phone:'0812345678 / 0898765432',preserve:true},
  {name:'New recipient',address:'New address 10200',phone:'0898765432'},
  {name:null,address:null,phone:'0812345678'},
 ]);
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0].update,{});
 assert.deepEqual(calls[1].update,{phone:'0898765432'});
 assert.equal(calls[1].create.phone,'0898765432');
 assert.equal(calls[1].create.customerCode,'C0001');
});
