import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Prisma} from '@prisma/client';
import {db,withDatabase,registerDatabaseSchema} from '../src/lib/db';
import {CustomerRegistrationInputError,parseCustomerRegistration,registerCustomerByAdmin,setCustomerMembership} from '../src/lib/admin-customer-registration';
import {passwordHash} from '../src/lib/crypto';

const input={name:'ลูกค้าทดสอบ',phone:'0812345678',address:'123 กรุงเทพ 10110',level:'Gold',password:'customer-password',confirmation:'customer-password'};

test('manual registration validates complete profile, initial level and confirmed password',()=>{
 assert.equal(parseCustomerRegistration(input).level,'Gold');
 for(const change of [{level:'owner'},{password:'short',confirmation:'short'},{confirmation:'different'},{phone:'123'},{address:'missing postal code'}]){
  assert.throws(()=>parseCustomerRegistration({...input,...change}),CustomerRegistrationInputError);
 }
});

test('manual registration creates an approved password account, starting membership and audit in one transaction',async t=>{
 const original=db.$transaction;
 const originalSecret=process.env.USER_HASH_SECRET;
 process.env.USER_HASH_SECRET='manual-customer-unit-test';
 t.after(()=>{db.$transaction=original;if(originalSecret===undefined)delete process.env.USER_HASH_SECRET;else process.env.USER_HASH_SECRET=originalSecret;});
 let customerData:Record<string,unknown>={},membership:Record<string,unknown>={},audit:Record<string,unknown>={};
 const locks:string[]=[];
 const tx={
  $queryRawUnsafe:async(_query:string,key:string)=>{locks.push(key);return [];},
  $queryRaw:async()=>[],
  customer:{findMany:async()=>[],create:async({data}:{data:Record<string,unknown>})=>{customerData=data;return {code:'CUS-00000001',...data};}},
  crmMembershipReview:{create:async({data}:{data:Record<string,unknown>})=>{membership=data;return data;}},
  auditLog:{create:async({data}:{data:Record<string,unknown>})=>{audit=data;return data;}},
 };
 db.$transaction=(async(callback:(client:Prisma.TransactionClient)=>unknown)=>callback(tx as unknown as Prisma.TransactionClient)) as typeof original;
 const result=await registerCustomerByAdmin({...input,keepLevel:true},'owner',new Date('2026-11-10T05:00:00Z'));
 assert.deepEqual(result,{created:true,customer:{code:'C0001',name:input.name,level:'Gold',locked:true}});
 assert.equal(customerData.portalRegistrationPending,false);
 assert.equal(customerData.portalProfileIncomplete,false);
 assert.equal(customerData.portalPasswordHash,passwordHash(input.password,customerData.portalPasswordSalt as string));
 assert.equal(customerData.referrerId,undefined);
 assert.equal(membership.level,'Gold');assert.equal(membership.month,'2026-11');
 assert.equal(membership.assessedMonth,'2026-10');assert.equal(membership.decision,'MANUAL_LOCKED');
 assert.ok(locks.includes('draft-customer-phone:0812345678'));
 assert.equal(audit.action,'CUSTOMER_REGISTERED_BY_ADMIN');
 assert.ok(!JSON.stringify(audit).includes(input.password));
});

test('existing memberships can be changed, locked and released with an audit and no account changes',async t=>{
 const original=db.$transaction;t.after(()=>{db.$transaction=original;});
 let review={level:'Silver',failedMonths:1,decision:'FAILED_FIRST'},audit:Record<string,unknown>={};
 const tx={
  $queryRawUnsafe:async()=>[],
  customer:{findUnique:async()=>({code:'CUS-00000001'})},
  crmMembershipReview:{
   findFirst:async()=>review,
   upsert:async({where,update}:{where:{customerCode_month:{customerCode:string;month:string}};update:typeof review})=>{
    assert.equal(where.customerCode_month.customerCode,'CUS-00000001');
    assert.equal(where.customerCode_month.month,'2026-11');review={...review,...update};return review;
   },
  },
  auditLog:{create:async({data}:{data:Record<string,unknown>})=>{audit=data;return data;}},
 };
 db.$transaction=(async(callback:(client:Prisma.TransactionClient)=>unknown)=>callback(tx as unknown as Prisma.TransactionClient)) as typeof original;
 const at=new Date('2026-11-10T05:00:00Z');
 assert.deepEqual(await setCustomerMembership({code:'C0001',level:'Gold',keepLevel:true},'owner',at),{code:'C0001',level:'Gold',locked:true});
 assert.deepEqual(review,{level:'Gold',failedMonths:0,decision:'MANUAL_LOCKED'});
 assert.equal(audit.action,'CUSTOMER_MEMBERSHIP_CHANGED');
 assert.deepEqual(await setCustomerMembership({code:'C0001',level:'Bronze',keepLevel:false},'owner',at),{code:'C0001',level:'Bronze',locked:false});
 assert.deepEqual(review,{level:'Bronze',failedMonths:0,decision:'MANUAL_SET'});
 assert.throws(()=>parseCustomerRegistration({...input,keepLevel:'false'}),CustomerRegistrationInputError);
});

test('an existing phone returns its customer code without replacing its password or membership',async t=>{
 const original=db.$transaction;
 t.after(()=>{db.$transaction=original;});
 const tx={
  $queryRawUnsafe:async()=>[], $queryRaw:async()=>[{code:'CUS-00000002'}],
  customer:{findMany:async()=>[{code:'CUS-00000002',name:'Existing'}],create:async()=>{assert.fail('must not create a duplicate');}},
 };
 db.$transaction=(async(callback:(client:Prisma.TransactionClient)=>unknown)=>callback(tx as unknown as Prisma.TransactionClient)) as typeof original;
 assert.deepEqual(await registerCustomerByAdmin(input,'owner'),{created:false,customers:[{code:'C0002',name:'Existing'}]});
});

test('duplicate checks and registration use the selected shop database schema',async()=>{
 const captured:string[]=[];
 const client={
  $transaction:async(callback:(tx:unknown)=>unknown)=>callback({
   $queryRawUnsafe:async()=>[],
   $queryRaw:async(strings:unknown)=>{captured.push(String(strings));return [{code:'CUS-00000003'}];},
   customer:{findMany:async()=>[{code:'CUS-00000003',name:'Shop customer'}]},
  }),
 } as unknown as typeof db;
 registerDatabaseSchema(client,'shop_registration_test');
 const result=await withDatabase(client,()=>registerCustomerByAdmin(input,'shop-owner'));
 assert.equal(result.created,false);
 assert.ok(captured.length>0);
});
