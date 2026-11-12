import {visibleWebsiteOrders} from './order-list-visibility';
import {validContactPhones} from './contact-phones';
import {saveCustomerDeliveryAddresses} from './customer-delivery-addresses';
import {randomUUID} from 'node:crypto';
import {Prisma,type WebsiteOrder} from '@prisma/client';
import {z} from 'zod';
import {db,transaction,userLock} from './db';
import {sha} from './crypto';
import {canonicalCustomerCode} from './customer-code';
import {stockCode} from './stock-code';
import {normalizeStockPackage} from './stock-product-input';
import {loadCustomerCatalog} from './customer-catalog';
import {customerIdentity} from './order-customer';
import {portalProfile} from './customer-portal';
import {parseRewardImage} from './crm-reward-image';
import {websiteShippingFees,websitePaymentReady,type WebsitePaymentDetails,type WebsitePaymentMethod} from './website-payment';
import {loadWebsitePaymentSettings} from './website-payment-settings';
import {userKey} from './crypto';
import {admitOrderText} from './order-intake';
import {orderRejectionReasons} from './order-validation';
import type {StockReader} from './order-stock-admission';
import {websiteOrderStockItems} from './website-order-stock';

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
 intakeOrderId:string|null;
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
 delivery:z.object({name:z.string().trim().min(1).max(200),address:z.string().trim().min(1).max(2000),phone:z.string().trim().min(1).max(2000).optional()}).optional(),
});
const reviewBase={
 id:z.string().min(1).max(100),
 note:z.string().trim().max(1000).default(''),
 expectedStatus:z.literal('PENDING_REVIEW'),
};
export const websiteOrderPayments=['COD','โอน'] as const;
const reviewInput=z.discriminatedUnion('status',[
 z.object({...reviewBase,status:z.literal('APPROVED'),payment:z.enum(websiteOrderPayments),amountSatang:positiveSatang,sellerCode:z.string().trim().regex(/^[A-Za-z0-9._-]{3,64}$/)}),
 z.object({...reviewBase,status:z.literal('REJECTED')}),
]);
export class WebsiteOrderApprovalError extends Error{
 constructor(readonly reasons:string[]){super('APPROVAL_BLOCKED');}
}
const baht=(satang:number)=>(satang/100).toFixed(2);
const grams=(value:number)=>String(Number(value.toFixed(3)));

// Approved website orders become standard order text so the LINE intake rules handle seller, commission, CRM and stock.
export function websiteOrderText(order:Pick<WebsiteOrder,'orderNumber'|'customerCode'|'recipient'|'phone'|'address'|'items'>,input:{payment:string;amountSatang:number;sellerCode:string},title?:string|null){
 const prefix=title?.trim()?title.trim()+' ':'';
 const recipient=prefix&&order.recipient.startsWith(prefix)?order.recipient.slice(prefix.length):order.recipient;
 const lines=(order.items as WebsiteOrderLine[]).map(item=>item.code+' x '+grams(item.grams*item.quantity)+' G = '+item.quantity+' × '+item.pack+' @ '+baht(item.unitPriceSatang));
 return ['รหัสผู้ขาย: '+input.sellerCode,'รหัสลูกค้า: '+order.customerCode,'ชื่อผู้รับ: '+recipient,'เบอร์โทร: '+order.phone,'ที่อยู่: '+order.address,'สินค้า:',...lines,'ยอดรวม: '+baht(input.amountSatang),'ชำระเงิน: '+input.payment,'ออเดอร์เว็บไซต์: '+order.orderNumber].join('\n');
}

// Stock snapshots are refreshed about once a minute; holds created since the snapshot are deducted here.
async function recentStockHolds(tx:Prisma.TransactionClient,since:Date){
 const [orders,reservations]=await Promise.all([
  tx.websiteOrder.findMany({where:{status:'PENDING_REVIEW',createdAt:{gte:since}},select:{items:true}}),
  tx.stockReservation.findMany({where:{status:'QUEUED',createdAt:{gte:since}},select:{items:true}}),
 ]);
 const held=new Map<string,bigint>();
 for(const item of [...orders.flatMap(order=>websiteOrderStockItems(order.items)),...reservations.flatMap(row=>Array.isArray(row.items)?row.items as {code:string;quantityMilliG:number}[]:[])]){
  if(typeof item?.code!=='string'||!Number.isSafeInteger(item.quantityMilliG))continue;
  held.set(item.code,(held.get(item.code)??0n)+BigInt(item.quantityMilliG));
 }
 return held;
}

const orderSelect={
 id:true,orderNumber:true,customerCode:true,requestKey:true,requestFingerprint:true,status:true,
 items:true,totalSatang:true,paymentMethod:true,subtotalSatang:true,shippingSatang:true,bankDetails:true,slipVersion:true,
 recipient:true,phone:true,address:true,reviewNote:true,reviewedBy:true,reviewedAt:true,intakeOrderId:true,createdAt:true,updatedAt:true,
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
  intakeOrderId:order.intakeOrderId,
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
  ...(input.delivery?{delivery:input.delivery}:{}),
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
   delivery=portalProfile({name:input.delivery?.name??customer.name,phone:input.delivery?.phone??customer.phone,address:input.delivery?.address??customer.address});
  }catch{throw Error('INVALID_DELIVERY');}
  if(input.delivery)await userLock(tx,'customer-profile:'+code);
  // Serialize with LINE order admission so two channels cannot sell the same remaining stock.
  await userLock(tx,'stock-sheet-add');
  const catalog=await loadCustomerCatalog(tx,{merchandising:false});
  const products=new Map(catalog.products.map(product=>[product.code,product]));
  const held=catalog.readAt?await recentStockHolds(tx,new Date(catalog.readAt)):new Map<string,bigint>();
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
   if(!Number.isSafeInteger(available)||needed+(held.get(item.code)??0n)>BigInt(available))throw Error('STOCK_CHANGED');
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
  if(input.delivery){
   await saveCustomerDeliveryAddresses(tx,code,[{...customer,preserve:true},delivery]);
   const phones=[...new Set([...(validContactPhones(customer.phone??'')??[]),...validContactPhones(delivery.phone)!])].join(' / ');
   await tx.customer.update({where:{code},data:{name:delivery.name,address:delivery.address,phone:phones,identityKey:customerIdentity(delivery.name,phones)}});
  }
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
   recipient:input.delivery?delivery.name:[customer.title,delivery.name].filter(Boolean).join(' '),
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

export async function reviewWebsiteOrder(actor:string,value:unknown,stockReader?:StockReader){
 const parsed=reviewInput.safeParse(value);
 if(!parsed.success)throw Error('INVALID_WEBSITE_ORDER_REVIEW');
 const input=parsed.data;
 return transaction(async tx=>{
  await userLock(tx,'website-order-review:'+input.id);
  const current=await tx.websiteOrder.findUnique({where:{id:input.id},select:orderSelect});
  if(!current)throw Error('WEBSITE_ORDER_NOT_FOUND');
  if(current.status===input.status)return websiteOrderSummary(current);
  if(current.status!==input.expectedStatus)throw Error('REVIEW_CONFLICT');
  // Leave PENDING_REVIEW first so this order's own stock hold is not counted against its admission.
  const updated=await tx.websiteOrder.updateMany({
   where:{id:current.id,status:input.expectedStatus},
   data:{status:input.status,reviewNote:input.note,reviewedBy:actor,reviewedAt:new Date()},
  });
  if(updated.count!==1)throw Error('REVIEW_CONFLICT');
  let intakeOrderNumber:string|null=null;
  if(input.status==='APPROVED'){
   const blocked=orderRejectionReasons({customerCode:current.customerCode,address:current.address,phone:current.phone});
   if(blocked.length)throw new WebsiteOrderApprovalError(blocked);
   const storedSlip=input.payment==='โอน'?await tx.websiteOrder.findUnique({where:{id:current.id},select:{slipData:true,slipMime:true,slipVersion:true}}):null;
   if(input.payment==='โอน'&&(!storedSlip?.slipData||!storedSlip.slipMime||!storedSlip.slipVersion))throw new WebsiteOrderApprovalError(['กรุณาแนบรูปหลักฐานการโอนเงิน']);
   const customer=await tx.customer.findUnique({where:{code:current.customerCode},select:{title:true}});
   const admitted=await admitOrderText(tx,{
    text:websiteOrderText(current,input,customer?.title),
    eventKey:userKey('website-order-event:'+current.id),
    messageKey:userKey('website-order-message:'+current.id),
    groupKey:'website',senderKey:null,eventAt:new Date(),actor,paymentSlip:storedSlip?.slipData?{imageData:storedSlip.slipData,imageMime:storedSlip.slipMime!,imageVersion:storedSlip.slipVersion!}:undefined,
   },stockReader);
   if('reasons' in admitted)throw new WebsiteOrderApprovalError(admitted.reasons);
   intakeOrderNumber=admitted.order.orderNumber;
   await tx.websiteOrder.update({where:{id:current.id},data:{intakeOrderId:admitted.order.id}});
  }
  const saved=await tx.websiteOrder.findUniqueOrThrow({where:{id:current.id},select:orderSelect});
  await tx.auditLog.create({data:{
   actor,action:'WEBSITE_ORDER_REVIEWED',entityId:saved.id,
   details:{orderNumber:saved.orderNumber,status:saved.status,note:input.note,...(input.status==='APPROVED'?{payment:input.payment,amountSatang:input.amountSatang,sellerCode:input.sellerCode,intakeOrderNumber}:{})},
  }});
  return websiteOrderSummary(saved);
 },55000);
}

export async function pendingWebsiteOrderCount(){
 return db.websiteOrder.count({where:{status:'PENDING_REVIEW'}});
}
export async function loadWebsiteOrdersForCustomer(customerCode:string){
 const orders=await db.websiteOrder.findMany({
  where:{customerCode:canonicalCustomerCode(customerCode)},orderBy:{createdAt:'desc'},take:100,select:orderSelect,
 });
 return (await visibleWebsiteOrders(orders)).map(websiteOrderSummary);
}
export async function listWebsiteOrders(status?:string){
 if(status!==undefined&&!['PENDING_REVIEW','APPROVED','REJECTED'].includes(status))throw Error('INVALID_WEBSITE_ORDER_STATUS');
 const orders=await db.websiteOrder.findMany({where:status?{status}:{},orderBy:{createdAt:'desc'},take:200,select:orderSelect});
 return (await visibleWebsiteOrders(orders)).map(websiteOrderSummary);
}
