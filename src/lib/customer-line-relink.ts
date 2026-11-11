import {transaction,userLock} from './db';
import {canonicalCustomerCode} from './customer-code';
import {random,sha} from './crypto';
import {baseUrl} from './config';

export const customerLineRevocationId=(key:string)=>'customer-line-revoked:'+key;

// Administrative repair: revoke the old identity before issuing a new,
// single-use link. Never move one LINE identity onto another customer here.
export async function resetCustomerLineLinks(actor:string,entries:{code:string;expectedLineUserKey:string}[]){
 const targets=entries.map(entry=>({...entry,code:canonicalCustomerCode(entry.code)})).sort((a,b)=>a.code.localeCompare(b.code));
 if(!targets.length||targets.length>20||new Set(targets.map(t=>t.code)).size!==targets.length||targets.some(t=>!/^[a-f0-9]{64}$/.test(t.expectedLineUserKey)))throw Error('INVALID_LINE_RESET');
 const links=targets.map(target=>({...target,token:random()}));
 await transaction(async tx=>{
  for(const key of [...new Set(targets.map(t=>t.expectedLineUserKey))].sort())await userLock(tx,key);
  for(const target of targets){await userLock(tx,'customer-profile:'+target.code);await userLock(tx,'customer-access:'+target.code);}
  for(const target of links){
   const customer=await tx.customer.findUniqueOrThrow({where:{code:target.code}});
   if(customer.lineUserKey!==target.expectedLineUserKey)throw Error('CUSTOMER_LINE_CHANGED');
   // Conversion ownership is a separate financial identity and must not be
   // rewritten by a contact-link repair.
   if(customer.conversionId||await tx.conversion.findUnique({where:{userKey:target.expectedLineUserKey},select:{id:true}}))throw Error('CONVERSION_REVIEW_REQUIRED');
   const oldLinks=await tx.customerAccessLink.findMany({where:{customerCode:target.code},select:{tokenHash:true}});
   if(oldLinks.length)await tx.oAuthAttempt.deleteMany({where:{customerLinkHash:{in:oldLinks.map(link=>link.tokenHash)}}});
   await tx.customerAccessLink.deleteMany({where:{customerCode:target.code}});
   await tx.auditLog.upsert({where:{id:customerLineRevocationId(target.expectedLineUserKey)},create:{id:customerLineRevocationId(target.expectedLineUserKey),actor,action:'CUSTOMER_LINE_RELINK_REQUIRED',entityId:target.code,details:{}},update:{actor,entityId:target.code}});
   await tx.customer.update({where:{code:target.code},data:{lineUserKey:null}});
   await tx.customerAccessLink.create({data:{tokenHash:sha(target.token),customerCode:target.code,createdBy:actor,expiresAt:null}});
   await tx.auditLog.create({data:{actor,action:'CUSTOMER_LINE_UNLINKED',entityId:target.code,details:{reason:'owner requested correction of incorrect linking'}}});
   await tx.auditLog.create({data:{actor,action:'CUSTOMER_ACCESS_LINK_CREATED',entityId:target.code,details:{reason:'replacement after LINE unlink'}}});
  }
 });
 return links.map(target=>({code:target.code,url:baseUrl()+'/api/customer/login?link='+encodeURIComponent(target.token),expiresAt:null}));
}
