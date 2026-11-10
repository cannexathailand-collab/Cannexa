import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {db} from '../src/lib/db';
import {deleteCustomerProfile} from '../src/lib/customer-profile-deletion';

test('deleting a member clears contact and login data while retries preserve a later registration',async context=>{
 const original=db.$transaction;
 context.after(()=>{db.$transaction=original;});
 const customer:any={code:'CUS-00000001',name:'Test',phone:'0812345678',address:'Bangkok 10110',portalPasswordHash:'hash',portalUsername:'username',lineUserKey:'line-key',conversionId:'conversion'};
 const audits:any[]=[];
 let addresses=2,links=1;
 const tx={
  $queryRawUnsafe:async()=>[],
  customer:{findUnique:async()=>customer,update:async({data}:any)=>Object.assign(customer,data)},
  customerDeliveryAddress:{deleteMany:async()=>{addresses=0;}},
  customerAccessLink:{deleteMany:async()=>{links=0;}},
  lineMessageRecipient:{deleteMany:async({where}:any)=>{assert.equal(where.lineUserKey,customer.lineUserKey);}},
  auditLog:{findFirst:async({where}:any)=>audits.find(row=>row.details.requestKey===where.details.equals),create:async({data}:any)=>{audits.push(data);}},
 };
 db.$transaction=((work:any)=>work(tx)) as typeof db.$transaction;
 const request={code:customer.code,requestKey:randomUUID()};
 await deleteCustomerProfile('owner',request);
 for(const field of ['name','phone','address','portalPasswordHash','portalUsername','registrationPhone','registeredAt'])assert.equal(customer[field],null);
 assert.equal(customer.lineUserKey,'line-key');assert.equal(customer.conversionId,'conversion');
 assert.equal(customer.portalProfileIncomplete,true);assert.equal(customer.portalRegistrationPending,true);
 assert.ok(customer.profileResetAt instanceof Date);assert.equal(addresses,0);assert.equal(links,0);
 customer.phone='0898765432';customer.portalProfileIncomplete=false;
 await deleteCustomerProfile('owner',request);
 assert.equal(customer.phone,'0898765432');assert.equal(audits.length,1);
 assert.deepEqual(audits[0].details,{requestKey:request.requestKey});
 await assert.rejects(deleteCustomerProfile('owner',{code:customer.code,requestKey:'bad'}),/INVALID_CUSTOMER_DELETE/);
});
