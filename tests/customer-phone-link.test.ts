import assert from 'node:assert/strict';import {test} from 'node:test';
import type {Customer,Prisma} from '@prisma/client';
import {linkCustomerPhoneMatch} from '../src/lib/customer-phone-link';
function fixture(){
 const key='a'.repeat(64),current={code:'NEW',lineUserKey:key,_count:{orders:0,websiteOrders:0,rewardRedemptions:0,deliveryAddresses:0,accessLinks:0}} as unknown as Customer&{_count:Record<string,number>};
 const target={code:'OLD',lineUserKey:null,name:'Existing customer',phone:'0812345678',address:'Existing address',registeredAt:new Date('2020-01-01'),registrationPhone:'0812345678',referrerId:'existing-referrer',discoverySource:'LINE'} as unknown as Customer;
 const writes:any[]=[],tx={
  $queryRawUnsafe:async()=>[],conversion:{findUnique:async()=>null},
  customer:{findUniqueOrThrow:async({where}:any)=>where.code==='OLD'?target:current,update:async({where,data}:any)=>{writes.push({code:where.code,data});return {...(where.code==='OLD'?target:current),...data};},delete:async({where}:any)=>writes.push({deleted:where.code})},
  crmMembershipReview:{deleteMany:async()=>{}},auditLog:{create:async()=>{}},
 } as unknown as Prisma.TransactionClient;
 return {key,current,target,tx,writes};
}
test('unique phone linking preserves the existing customer and removes only an empty signup',async()=>{
 const f=fixture(),saved=await linkCustomerPhoneMatch(f.tx,f.current,'OLD',f.key,'0812345678',{discoverySource:'OTHER',referrerId:'new-referrer'});
 assert.equal(saved.code,'OLD');assert.equal(saved.lineUserKey,f.key);assert.equal(saved.name,'Existing customer');assert.equal(saved.address,'Existing address');assert.equal(saved.referrerId,'existing-referrer');assert.equal(saved.discoverySource,'LINE');assert.equal(saved.registeredAt,f.target.registeredAt);
 assert.deepEqual(f.writes[0],{code:'NEW',data:{lineUserKey:null}});assert.deepEqual(f.writes.at(-1),{deleted:'NEW'});
});
test('phone matching never overwrites another LINE account or a deleted customer',async()=>{
 for(const mode of ['linked','deleted']){const f=fixture();if(mode==='linked')f.target.lineUserKey='b'.repeat(64);else{f.target.profileResetAt=new Date();f.target.portalProfileIncomplete=true;}await assert.rejects(linkCustomerPhoneMatch(f.tx,f.current,'OLD',f.key,'0812345678',{referrerId:null}),/PHONE_ALREADY_LINKED|PHONE_LINK_REVIEW_REQUIRED/);assert.equal(f.writes.length,0);}
});
test('signup with orders, profile data or conversion history requires manual review',async()=>{
 for(const mode of ['order','name','conversion']){const f=fixture();if(mode==='order')f.current._count.orders=1;if(mode==='name')f.current.name='Already entered';if(mode==='conversion')f.current.conversionId='existing';await assert.rejects(linkCustomerPhoneMatch(f.tx,f.current,'OLD',f.key,'0812345678',{referrerId:null}),/PHONE_LINK_REVIEW_REQUIRED/);assert.equal(f.writes.length,0);}
});
