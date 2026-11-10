import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Prisma} from '@prisma/client';
import {saveCustomerDeliveryAddresses,loadCustomerDeliveryAddresses} from '../src/lib/customer-delivery-addresses';
import {db} from '../src/lib/db';

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

test('choosing an older address does not move it ahead of newer saved addresses',async context=>{
 const original={saved:db.customerDeliveryAddress.findMany,website:db.websiteOrder.findMany,orders:db.orderIntake.findMany,customer:db.customer.findUnique};
 context.after(()=>{db.customerDeliveryAddress.findMany=original.saved;db.websiteOrder.findMany=original.website;db.orderIntake.findMany=original.orders;db.customer.findUnique=original.customer;});
 const oldDate=new Date('2026-01-01'),newDate=new Date('2026-02-01');
 const older={name:'Older',address:'Old address 10110',phone:'0812345678',createdAt:oldDate,updatedAt:oldDate};
 const newer={name:'Newer',address:'New address 10200',phone:'0898765432',createdAt:newDate,updatedAt:newDate};
 db.customerDeliveryAddress.findMany=(async()=>[older,newer]) as unknown as typeof db.customerDeliveryAddress.findMany;
 db.websiteOrder.findMany=(async()=>[]) as unknown as typeof db.websiteOrder.findMany;
 db.orderIntake.findMany=(async()=>[]) as unknown as typeof db.orderIntake.findMany;
 db.customer.findUnique=(async()=>null) as unknown as typeof db.customer.findUnique;
 const before=await loadCustomerDeliveryAddresses('C0001');
 older.updatedAt=new Date('2026-03-01');
 const after=await loadCustomerDeliveryAddresses('C0001');
 assert.deepEqual(before.map(address=>address.name),['Newer','Older']);
 assert.deepEqual(after.map(address=>address.id),before.map(address=>address.id));
});
