import {randomUUID} from 'node:crypto';
import {Prisma,type WebsiteOrder} from '@prisma/client';
import {z} from 'zod';
import {db,transaction,userLock} from './db';
import {sha} from './crypto';
import {canonicalCustomerCode} from './customer-code';
import {stockCode} from './stock-code';
import {normalizeStockPackage} from './stock-product-input';
import {loadCustomerCatalog} from './customer-catalog';
import {portalProfile} from './customer-portal';
import {parseRewardImage} from './crm-reward-image';
import {websiteShippingFees,websitePaymentReady,type WebsitePaymentDetails,type WebsitePaymentMethod} from './website-payment';
import {loadWebsitePaymentSettings} from './website-payment-settings';

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
 paymentMethod:WebsitePaymentMethod|null;
 subtotalSatang:number;
 shippingSatang:number;
 bankDetails:WebsitePaymentDetails|null;
 slipVersion:string|null;
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
 paymentMethod:z.enum(['TRANSFER','COD']).optional(),
 expectedShippingSatang:z.number().int().nonnegative().max(2147483647).optional(),
 bankVersion:z.string().min(1).max(100).nullable().optional(),
 slip:z.string().optional(),
});
const reviewInput=z.object({
 id:z.string().min(1).max(100),
 status:z.enum(['APPROVED','REJECTED']),
 note:z.string().trim().max(1000).default(''),
 expectedStatus:z.literal('PENDING_REVIEW'),
});

const orderSelect={
 id:true,orderNumber:true,customerCode:true,requestKey:true,requestFingerprint:true,status:true,
 items:true,totalSatang:true,paymentMethod:true,subtotalSatang:true,shippingSatang:true,bankDetails:true,slipVersion:true,
 recipient:true,phone:true,address:true,reviewNote:true,reviewedBy:true,reviewedAt:true,createdAt:true,updatedAt:true,
} satisfies Prisma.WebsiteOrderSelect;
type WebsiteOrderRecord=Omit<WebsiteOrder,'slipData'|'slipMime'>;

export function websiteOrderSummary(order:WebsiteOrderRecord):WebsiteOrderSummary{
 return {
  id:order.id,
  orderNumber:order.orderNumber,
  customerCode:order.customerCode,
  status:order.status as WebsiteOrderSummary['status'],
  items:order.items as WebsiteOrderLine[],
  totalSatang:order.totalSatang,
  paymentMethod:order.paymentMethod as WebsitePaymentMethod|null,
  subtotalSatang:order.subtotalSatang??order.totalSatang,
  shippingSatang:order.shippingSatang,
  bankDetails:order.bankDetails as WebsitePaymentDetails|null,
  slipVersion:order.slipVersion,
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
 let slip:ReturnType<typeof parseRewardImage>|null=null;
 if(input.slip!==undefined){
  try{slip=parseRewardImage(input.slip);}
  catch(error){throw Error(error instanceof Error&&error.message==='REWARD_IMAGE_TOO_LARGE'?'SLIP_TOO_LARGE':'INVALID_SLIP');}
 }
 const legacy=input.paymentMethod===undefined&&input.expectedShippingSatang===undefined&&input.bankVersion===undefined&&input.slip===undefined;
 const fingerprint=sha(JSON.stringify({
  items:input.items,expectedTotalSatang:input.expectedTotalSatang,
  ...(!legacy?{paymentMethod:input.paymentMethod??null,expectedShippingSatang:input.expectedShippingSatang??null,bankVersion:input.bankVersion??null,slipVersion:slip?.imageVersion??null}:{}),
 }));
 return transaction(async tx=>{
  await userLock(tx,'website-order:'+code);
  const customer=await tx.customer.findUnique({where:{code}});
  if(!customer)throw Error('CUSTOMER_NOT_FOUND');
  if(customer.portalRegistrationPending||customer.portalProfileIncomplete)throw Error('CUSTOMER_PENDING');
  const previous=await tx.websiteOrder.findUnique({
   where:{customerCode_requestKey:{customerCode:code,requestKey:input.requestKey}},select:orderSelect,
  });
  if(previous){
   if(previous.requestFingerprint!==fingerprint)throw Error('REQUEST_CONFLICT');
   return websiteOrderSummary(previous);
  }
  if(!input.paymentMethod||input.expectedShippingSatang===undefined||input.bankVersion===undefined)throw Error('PAYMENT_REQUIRED');
  const shipping=websiteShippingFees[input.paymentMethod];
  if(input.expectedShippingSatang!==shipping)throw Error('SHIPPING_CHANGED');
  let bank:WebsitePaymentDetails|null=null;
  if(input.paymentMethod==='TRANSFER'){
   if(!slip)throw Error('SLIP_REQUIRED');
   bank=await loadWebsitePaymentSettings(tx);
   if(!websitePaymentReady(bank))throw Error('BANK_UNAVAILABLE');
   if(input.bankVersion!==bank.version)throw Error('BANK_CHANGED');
  }else if(slip||input.bankVersion!==null)throw Error('INVALID_PAYMENT');
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
  const grandTotal=total+shipping;
  if(grandTotal>2147483647)throw Error('ORDER_TOO_LARGE');
  if(grandTotal!==input.expectedTotalSatang)throw Error('TOTAL_CHANGED');
  const saved=await tx.websiteOrder.create({data:{
   orderNumber:'WEB-'+randomUUID().replaceAll('-','').slice(0,20).toUpperCase(),
   customerCode:code,
   requestKey:input.requestKey,
   requestFingerprint:fingerprint,
   items:snapshots,
   totalSatang:grandTotal,
   paymentMethod:input.paymentMethod,
   subtotalSatang:total,
   shippingSatang:shipping,
   bankDetails:bank??Prisma.DbNull,
   slipData:slip?.imageData,
   slipMime:slip?.imageMime,
   slipVersion:slip?.imageVersion,
   recipient:[customer.title,delivery.name].filter(Boolean).join(' '),
   phone:delivery.phone,
   address:delivery.address,
  },select:orderSelect});
  await tx.auditLog.create({data:{
   actor:'customer',action:'WEBSITE_ORDER_SUBMITTED',entityId:saved.id,
   details:{orderNumber:saved.orderNumber,customerCode:code,paymentMethod:input.paymentMethod,subtotalSatang:total,shippingSatang:shipping,totalSatang:grandTotal},
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
  const current=await tx.websiteOrder.findUnique({where:{id:input.id},select:orderSelect});
  if(!current)throw Error('WEBSITE_ORDER_NOT_FOUND');
  if(current.status===input.status)return websiteOrderSummary(current);
  if(current.status!==input.expectedStatus)throw Error('REVIEW_CONFLICT');
  const updated=await tx.websiteOrder.updateMany({
   where:{id:current.id,status:input.expectedStatus},
   data:{status:input.status,reviewNote:input.note,reviewedBy:actor,reviewedAt:new Date()},
  });
  if(updated.count!==1)throw Error('REVIEW_CONFLICT');
  const saved=await tx.websiteOrder.findUniqueOrThrow({where:{id:current.id},select:orderSelect});
  await tx.auditLog.create({data:{
   actor,action:'WEBSITE_ORDER_REVIEWED',entityId:saved.id,
   details:{orderNumber:saved.orderNumber,status:saved.status,note:input.note},
  }});
  return websiteOrderSummary(saved);
 });
}

export async function loadWebsiteOrdersForCustomer(customerCode:string){
 const orders=await db.websiteOrder.findMany({
  where:{customerCode:canonicalCustomerCode(customerCode)},orderBy:{createdAt:'desc'},take:100,select:orderSelect,
 });
 return orders.map(websiteOrderSummary);
}
export async function listWebsiteOrders(status?:string){
 if(status!==undefined&&!['PENDING_REVIEW','APPROVED','REJECTED'].includes(status))throw Error('INVALID_WEBSITE_ORDER_STATUS');
 const orders=await db.websiteOrder.findMany({where:status?{status}:{},orderBy:{createdAt:'desc'},take:200,select:orderSelect});
 return orders.map(websiteOrderSummary);
}
