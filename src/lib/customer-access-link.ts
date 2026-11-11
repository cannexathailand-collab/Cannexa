import {transaction,userLock} from './db';
import {baseUrl} from './config';
import {random,sha} from './crypto';
import {canonicalCustomerCode} from './customer-code';

export async function createCustomerAccessLink(input:string,actor:string){
 const code=canonicalCustomerCode(input);
 const token=random();
 await transaction(async tx=>{
  await userLock(tx,'customer-profile:'+code);
  await userLock(tx,'customer-access:'+code);
  const customer=await tx.customer.findUnique({where:{code},select:{lineUserKey:true,profileResetAt:true,portalProfileIncomplete:true}});
  if(!customer||customer.profileResetAt&&customer.portalProfileIncomplete)throw Error('CUSTOMER_NOT_FOUND');
  if(customer.lineUserKey)throw Error('ALREADY_LINKED');
  await tx.customerAccessLink.deleteMany({where:{customerCode:code,usedAt:null}});
  await tx.customerAccessLink.create({data:{tokenHash:sha(token),customerCode:code,createdBy:actor,expiresAt:null}});
  await tx.auditLog.create({data:{actor,action:'CUSTOMER_ACCESS_LINK_CREATED',entityId:code,details:{}}});
 });
 return {url:baseUrl()+'/api/customer/login?link='+encodeURIComponent(token),expiresAt:null};
}
