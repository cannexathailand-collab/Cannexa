import {db} from './db';
import {sha} from './crypto';

export async function loadCustomerDeliveryAddresses(customerCode:string){
 const [saved,websiteOrders,orders]=await Promise.all([
  db.customerDeliveryAddress.findMany({where:{customerCode},orderBy:{updatedAt:'desc'},select:{name:true,address:true,phone:true,updatedAt:true}}),
  db.websiteOrder.findMany({where:{customerCode},orderBy:{createdAt:'desc'},select:{recipient:true,address:true,phone:true,createdAt:true}}),
  db.orderIntake.findMany({where:{customerCode},orderBy:{createdAt:'desc'},select:{recipient:true,address:true,phone:true,createdAt:true}}),
 ]);
 const history=[
  ...saved.map(entry=>({...entry,date:entry.updatedAt})),
  ...websiteOrders.map(entry=>({name:entry.recipient,address:entry.address,phone:entry.phone,date:entry.createdAt})),
  ...orders.map(entry=>({name:entry.recipient,address:entry.address,phone:entry.phone,date:entry.createdAt})),
 ].sort((left,right)=>right.date.getTime()-left.date.getTime());
 const addresses=new Map<string,{id:string;name:string;address:string;phone:string}>();
 for(const entry of history){
  if(!entry.name?.trim()||!entry.address?.trim()||!entry.phone?.trim())continue;
  const id=sha(JSON.stringify([entry.name.trim(),entry.address.trim()]));
  if(!addresses.has(id))addresses.set(id,{id,name:entry.name,address:entry.address,phone:entry.phone});
 }
 return [...addresses.values()];
}
