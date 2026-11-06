import type {Prisma} from '@prisma/client';
import {sha} from './crypto';
import {normalizeName,normalizePhone} from './shipment-matching';
export function customerIdentity(name:string,phone:string){return sha(normalizeName(name)+'|'+normalizePhone(phone));}
export async function resolveOrderCustomer(tx:Prisma.TransactionClient,input:{code?:string;name:string;phone:string;sellerId:string}){
 const identityKey=customerIdentity(input.name,input.phone);
 if(input.code){
  const customer=await tx.customer.findUnique({where:{code:input.code},include:{conversion:{select:{source:true}}}});
  if(!customer||customer.conversion&&customer.conversion.source!=='LINE')return null;
  if(customer.identityKey&&customer.identityKey!==identityKey)throw Error('CUSTOMER_IDENTITY_CONFLICT');
  const other=await tx.customer.findUnique({where:{identityKey}});
  if(other&&other.code!==customer.code)throw Error('CUSTOMER_IDENTITY_CONFLICT');
  return customer.identityKey?customer:tx.customer.update({where:{code:customer.code},data:{identityKey,name:input.name,phone:normalizePhone(input.phone)}});
 }
 return tx.customer.upsert({where:{identityKey},create:{identityKey,name:input.name,phone:normalizePhone(input.phone),referrerId:input.sellerId},update:{}});
}
