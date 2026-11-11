import type {Customer,Prisma} from '@prisma/client';
import {userLock} from './db';

// Only replace an empty LINE signup shell. Financial/customer records are never
// merged or moved here; the established customer keeps its original code.
export async function linkCustomerPhoneMatch(tx:Prisma.TransactionClient,current:Customer,targetCode:string,key:string,phone:string,metadata:{discoverySource?:string|null;referrerId:string|null;customerCategory?:string;businessLicenseNumber?:string|null}){
 if(targetCode===current.code)throw Error('PHONE_LINK_REVIEW_REQUIRED');
 await userLock(tx,'customer-profile:'+targetCode);
 const target=await tx.customer.findUniqueOrThrow({where:{code:targetCode}});
 if(target.lineUserKey)throw Error('PHONE_ALREADY_LINKED');
 if(target.profileResetAt&&target.portalProfileIncomplete)throw Error('PHONE_LINK_REVIEW_REQUIRED');
 const shell=await tx.customer.findUniqueOrThrow({where:{code:current.code},include:{_count:{select:{orders:true,websiteOrders:true,rewardRedemptions:true,deliveryAddresses:true,accessLinks:true}}}});
 if(shell.lineUserKey!==key)throw Error('PHONE_LINK_CHANGED');
 if(shell.profileResetAt||shell.conversionId||shell.name||shell.phone||shell.address||shell.portalUsername||shell.portalPasswordHash||target.conversionId||Object.values(shell._count).some(count=>count>0)||await tx.conversion.findUnique({where:{userKey:key},select:{id:true}}))throw Error('PHONE_LINK_REVIEW_REQUIRED');
 await tx.customer.update({where:{code:shell.code},data:{lineUserKey:null}});
 const saved=await tx.customer.update({where:{code:target.code},data:{
  lineUserKey:key,phone:target.phone||phone,registrationPhone:target.registrationPhone??phone,
  registeredAt:target.registeredAt??new Date(),referrerId:target.referrerId??metadata.referrerId,
  ...(metadata.customerCategory===undefined?{}:{customerCategory:metadata.customerCategory,businessLicenseNumber:metadata.businessLicenseNumber}),
  ...(target.discoverySource||metadata.discoverySource===undefined?{}:{discoverySource:metadata.discoverySource}),
  portalProfileIncomplete:false,portalRegistrationPending:false,
 }});
 await tx.customer.delete({where:{code:shell.code}});
 await tx.crmMembershipReview.deleteMany({where:{customerCode:shell.code}});
 await tx.auditLog.create({data:{actor:'customer',action:'CUSTOMER_PHONE_LINE_LINKED',entityId:target.code,details:{temporaryCode:shell.code,source:'line-login-phone-match'}}});
 return saved;
}
