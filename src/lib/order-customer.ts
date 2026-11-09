import type {Prisma} from '@prisma/client';
import {sha} from './crypto';
import {normalizeName,normalizePhone} from './shipment-matching';
import {canonicalCustomerCode} from './customer-code';
import {contactPhones} from './contact-phones';
export function customerIdentity(name:string,phone:string){return sha(normalizeName(name)+'|'+(contactPhones(phone)[0]??normalizePhone(phone)));}
export async function resolveOrderCustomer(tx:Prisma.TransactionClient,input:{code?:string;name:string;phone:string;sellerId:string}){
 if(input.code){
  // A supplied customer code identifies the buyer. Delivery contacts belong to the order.
  return tx.customer.findUnique({where:{code:canonicalCustomerCode(input.code)}});
 }
 const identityKey=customerIdentity(input.name,input.phone);
 return tx.customer.upsert({where:{identityKey},create:{identityKey,name:input.name,phone:contactPhones(input.phone).join(' / ')},update:{}});
}
