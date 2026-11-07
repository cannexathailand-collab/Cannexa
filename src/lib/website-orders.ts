import {randomUUID} from 'node:crypto';
import type {WebsiteOrder} from '@prisma/client';
import {z} from 'zod';
import {db,transaction,userLock} from './db';
import {sha} from './crypto';
import {canonicalCustomerCode} from './customer-code';
import {stockCode} from './stock-code';
import {normalizeStockPackage} from './stock-product-input';
import {loadCustomerCatalog} from './customer-catalog';
import {portalProfile} from './customer-portal';

export type WebsiteOrderLine={
 code:string;
 name:string|null;
 pack:string;
 grams:number;
 quantity:number;
 unitPriceSatang:number;
 lineTotalSatang:number;
};
export type WebsiteOrderSummary={
 id:string;
 orderNumber:string;
 customerCode:string;
 status:'PENDING_REVIEW'|'APPROVED'|'REJECTED';
 items:WebsiteOrderLine[];
 totalSatang:number;
 recipient:string;
 phone:string;
 address:string;
 reviewNote:string;
 reviewedBy:string|null;
 reviewedAt:string|null;
 createdAt:string;
 updatedAt:string;
};
const positiveSatang=z.number().int().positive().max(2147483647);
const requestInput=z.object({
 requestKey:z.uuid(),
 items:z.array(z.object({
  code:stockCode,
  pack:z.string().min(1).max(50),
  quantity:z.number().int().min(1).max(999),
  expectedUnitPriceSatang:positiveSatang,
 })).min(1).max(100),
 expectedTotalSatang:positiveSatang,
});
const reviewInput=z.object({
 id:z.string().min(1).max(100),
 status:z.enum(['APPROVED','REJECTED']),
 note:z.string().trim().max(1000).default(''),
 expectedStatus:z.literal('PENDING_REVIEW'),
});

export function websiteOrderSummary(order:WebsiteOrder):WebsiteOrderSummary{
 return {
  id:order.id,
  orderNumber:order.orderNumber,
  customerCode:order.customerCode,
  status:order.status as WebsiteOrderSummary['status'],
  items:order.items as WebsiteOrderLine[],
  totalSatang:order.totalSatang,
  recipient:order.recipient,
  phone:order.phone,
  address:order.address,
  reviewNote:order.reviewNote,
  reviewedBy:order.reviewedBy,
  reviewedAt:order.reviewedAt?.toISOString()??null,
  createdAt:order.createdAt.toISOString(),
  updatedAt:order.updatedAt.toISOString(),
 };
}

export async function createWebsiteOrder(customerCode:string,value:unknown){
 const parsed=requestInput.safeParse(value);
 if(!parsed.success)throw Error('INVALID_WEBSITE_ORDER');
 let items;
 try{
  items=parsed.data.items.map(item=>({...item,pack:normalizeStockPackage(item.pack)}));
 }catch{throw Error('INVALID_WEBSITE_ORDER');}
 const keys=items.map(item=>item.code+'|'+item.pack);
 if(new Set(keys).size!==keys.length)throw Error('INVALID_WEBSITE_ORDER');
 const input={...parsed.data,items};
 const code=canonicalCustomerCode(customerCode);
 const fingerprint=sha(JSON.stringify({items:input.items,expectedTotalSatang:input.expectedTotalSatang}));
 return transaction(async tx=>{
  await userLock(tx,'website-order:'+code);
  const customer=await tx.customer.findUnique({where:{code}});
  if(!customer)throw Error('CUSTOMER_NOT_FOUND');
  if(customer.portalRegistrationPending||customer.portalProfileIncomplete)throw Error('CUSTOMER_PENDING');
  const previous=await tx.websiteOrder.findUnique({
   where:{customerCode_requestKey:{customerCode:code,requestKey:input.requestKey}},
  });
  if(previous){
   if(previous.requestFingerprint!==fingerprint)throw Error('REQUEST_CONFLICT');
   return websiteOrderSummary(previous);
  }
  let delivery;
  try{
   delivery=portalProfile({name:customer.name,phone:customer.phone,address:customer.address});
  }catch{throw Error('INVALID_DELIVERY');}
  const catalog=await loadCustomerCatalog(tx);
  const products=new Map(catalog.products.map(product=>[product.code,product]));
  const quantities=new Map<string,bigint>();
  let total=0;
  const snapshots:WebsiteOrderLine[]=input.items.map(item=>{
   const product=products.get(item.code);
   const price=product?.prices.find(candidate=>candidate.pack===item.pack);
   if(!product||!price||price.priceSatang<=0)throw Error('PRODUCT_UNAVAILABLE');
   if(price.priceSatang!==item.expectedUnitPriceSatang)throw Error('PRICE_CHANGED');
   if(product.available===null)throw Error('STOCK_CHANGED');
   const available=Math.round(product.available*1000);
   const needed=BigInt(Math.round(price.grams*1000))*BigInt(item.quantity)+(quantities.get(item.code)??0n);
   if(!Number.isSafeInteger(available)||needed>BigInt(available))throw Error('STOCK_CHANGED');
   quantities.set(item.code,needed);
   const lineTotal=price.priceSatang*item.quantity;
   total+=lineTotal;
   if(!Number.isSafeInteger(lineTotal)||!Number.isSafeInteger(total)||total>2147483647)throw Error('ORDER_TOO_LARGE');
   return {
    code:product.code,
    name:product.name,
    pack:price.pack,
    grams:price.grams,
    quantity:item.quantity,
    unitPriceSatang:price.priceSatang,
    lineTotalSatang:lineTotal,
   };
  });
  if(total!==input.expectedTotalSatang)throw Error('TOTAL_CHANGED');
  const saved=await tx.websiteOrder.create({data:{
   orderNumber:'WEB-'+randomUUID().replaceAll('-','').slice(0,20).toUpperCase(),
   customerCode:code,
   requestKey:input.requestKey,
   requestFingerprint:fingerprint,
   items:snapshots,
   totalSatang:total,
   recipient:[customer.title,delivery.name].filter(Boolean).join(' '),
   phone:delivery.phone,
   address:delivery.address,
  }});
  await tx.auditLog.create({data:{
   actor:'customer',action:'WEBSITE_ORDER_SUBMITTED',entityId:saved.id,
   details:{orderNumber:saved.orderNumber,customerCode:code,totalSatang:total},
  }});
  return websiteOrderSummary(saved);
 });
}

export async function reviewWebsiteOrder(actor:string,value:unknown){
 const parsed=reviewInput.safeParse(value);
 if(!parsed.success)throw Error('INVALID_WEBSITE_ORDER_REVIEW');
 const input=parsed.data;
 return transaction(async tx=>{
  await userLock(tx,'website-order-review:'+input.id);
  const current=await tx.websiteOrder.findUnique({where:{id:input.id}});
  if(!current)throw Error('WEBSITE_ORDER_NOT_FOUND');
  if(current.status===input.status)return websiteOrderSummary(current);
  if(current.status!==input.expectedStatus)throw Error('REVIEW_CONFLICT');
  const updated=await tx.websiteOrder.updateMany({
   where:{id:current.id,status:input.expectedStatus},
   data:{status:input.status,reviewNote:input.note,reviewedBy:actor,reviewedAt:new Date()},
  });
  if(updated.count!==1)throw Error('REVIEW_CONFLICT');
  const saved=await tx.websiteOrder.findUniqueOrThrow({where:{id:current.id}});
  await tx.auditLog.create({data:{
   actor,action:'WEBSITE_ORDER_REVIEWED',entityId:saved.id,
   details:{orderNumber:saved.orderNumber,status:saved.status,note:input.note},
  }});
  return websiteOrderSummary(saved);
 });
}

export async function loadWebsiteOrdersForCustomer(customerCode:string){
 const orders=await db.websiteOrder.findMany({
  where:{customerCode:canonicalCustomerCode(customerCode)},orderBy:{createdAt:'desc'},take:100,
 });
 return orders.map(websiteOrderSummary);
}
export async function listWebsiteOrders(status?:string){
 if(status!==undefined&&!['PENDING_REVIEW','APPROVED','REJECTED'].includes(status))throw Error('INVALID_WEBSITE_ORDER_STATUS');
 const orders=await db.websiteOrder.findMany({where:status?{status}:{},orderBy:{createdAt:'desc'},take:200});
 return orders.map(websiteOrderSummary);
}
