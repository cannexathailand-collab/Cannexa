import {db,transaction,userLock} from './db';
import {contactPhones,validContactPhones} from './contact-phones';
import {customerIdentity} from './order-customer';
import {displayCustomerCode} from './customer-code';
import {matchingCustomerPhones} from './customer-phone-matches';
export {matchingCustomerPhones} from './customer-phone-matches';
export function validCustomerPhone(value:string){const phones=validContactPhones(value);return phones?phones.join(' / '):null;}
const publicRows=(rows:Awaited<ReturnType<typeof matchingCustomerPhones>>)=>rows.map(r=>({customerCode:displayCustomerCode(r.code),recipient:r.name??'',phone:r.phone??''}));
export async function searchDraftCustomers(phoneInput:string){
 const phone=validCustomerPhone(phoneInput);if(!phone)throw Error('INVALID_PHONE');
 return publicRows(await matchingCustomerPhones(db,phone));
}
export async function createDraftCustomer(input:{name:string;phone:string;address?:string},actor:{username:string;affiliateId:string|null}){
 const name=input.name.trim(),phone=validCustomerPhone(input.phone),address=(input.address??'').trim();
 if(!name||name.length>200||!phone||address.length>2000)throw Error('INVALID_CUSTOMER');
 return transaction(async tx=>{
  for(const number of contactPhones(phone).sort())await userLock(tx,'draft-customer-phone:'+number);
  const found=await matchingCustomerPhones(tx,phone);if(found.length)return {created:false,customers:publicRows(found)};
  const row=await tx.customer.create({data:{name,phone,address:address||null,identityKey:customerIdentity(name,phone)}});
  await tx.auditLog.create({data:{actor:actor.username,action:'DRAFT_CUSTOMER_CREATED',entityId:row.code,details:{source:'order-draft'}}});
  return {created:true,customer:{customerCode:displayCustomerCode(row.code),recipient:row.name??'',phone:row.phone??'',address:row.address??''}};
 });
}
