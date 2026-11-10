import {db} from './db';
import {sha} from './crypto';
import type {Prisma} from '@prisma/client';

export async function saveCustomerDeliveryAddresses(tx:Prisma.TransactionClient,customerCode:string,entries:{name:string|null;address:string|null;phone:string|null;preserve?:boolean;createdAt?:Date}[]){
 for(const entry of entries){
  if(!entry.name||!entry.address||!entry.phone)continue;
  const fingerprint=sha(JSON.stringify([entry.name.trim(),entry.address.trim()]));
  await tx.customerDeliveryAddress.upsert({where:{customerCode_fingerprint:{customerCode,fingerprint}},create:{customerCode,fingerprint,name:entry.name,address:entry.address,phone:entry.phone,...(entry.preserve&&entry.createdAt?{createdAt:entry.createdAt}:{})},update:entry.preserve?{}:{phone:entry.phone}});
 }
}

export async function loadCustomerDeliveryAddresses(customerCode:string){
 const current=await db.customer.findUnique({where:{code:customerCode},select:{name:true,address:true,phone:true,createdAt:true,profileResetAt:true}});
 const sinceReset=current?.profileResetAt?{gt:current.profileResetAt}:undefined;
 const [saved,websiteOrders,orders]=await Promise.all([
  db.customerDeliveryAddress.findMany({where:{customerCode},orderBy:{createdAt:'desc'},select:{name:true,address:true,phone:true,createdAt:true,updatedAt:true}}),
  db.websiteOrder.findMany({where:{customerCode,...(sinceReset?{createdAt:sinceReset}:{})},orderBy:{createdAt:'desc'},select:{recipient:true,address:true,phone:true,createdAt:true}}),
  db.orderIntake.findMany({where:{customerCode,...(sinceReset?{eventAt:sinceReset}:{})},orderBy:{createdAt:'desc'},select:{recipient:true,address:true,phone:true,createdAt:true}}),
 ]);
 const history=[
  ...saved.map(entry=>({...entry,date:entry.updatedAt,firstUsedAt:entry.createdAt})),
  ...websiteOrders.map(entry=>({name:entry.recipient,address:entry.address,phone:entry.phone,date:entry.createdAt,firstUsedAt:entry.createdAt})),
  ...orders.map(entry=>({name:entry.recipient,address:entry.address,phone:entry.phone,date:entry.createdAt,firstUsedAt:entry.createdAt})),
 ].sort((left,right)=>right.date.getTime()-left.date.getTime());
 const addresses=new Map<string,{id:string;name:string;address:string;phone:string}>();
 const firstUsed=new Map<string,number>();
 for(const entry of history){
  if(!entry.name?.trim()||!entry.address?.trim()||!entry.phone?.trim())continue;
  const id=sha(JSON.stringify([entry.name.trim(),entry.address.trim()]));
  if(!addresses.has(id))addresses.set(id,{id,name:entry.name,address:entry.address,phone:entry.phone});
  firstUsed.set(id,Math.min(firstUsed.get(id)??Infinity,entry.firstUsedAt.getTime()));
 }
 if(current?.name?.trim()&&current.address?.trim()&&current.phone?.trim()){
  const id=sha(JSON.stringify([current.name.trim(),current.address.trim()]));
  if(!addresses.has(id)){
   addresses.set(id,{id,name:current.name,address:current.address,phone:current.phone});
   firstUsed.set(id,current.createdAt.getTime());
  }
 }
 return [...addresses.values()].sort((left,right)=>firstUsed.get(right.id)!-firstUsed.get(left.id)!||left.id.localeCompare(right.id));
}
