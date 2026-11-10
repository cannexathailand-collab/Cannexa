import {canAccessOrderDocument,type DocumentAccount} from './order-document-access';
import {isSeparateShopDatabase} from './db';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {db,transaction,userLock} from './db';
import {sha} from './crypto';
import {bangkokDay,dayStart} from './sales-dates';
import {quotedTotal} from './shipment-matching';
import {orderStockItems} from './order-stock-items';
import {inclusiveTaxTotals,taxBuyerSchema,taxInvoiceLineSchema,validThaiTaxId} from './tax-invoice-values';
import {documentBrandingSnapshot,documentBrandingSchema} from './document-branding';

const settingsInput=z.object({
 enabled:z.boolean(),registeredOn:z.string(),branchCode:z.string().regex(/^\d{5}$/),
 vatRateBps:z.number().int().min(0).max(10000),expectedVersion:z.string().nullable(),
});
export async function saveTaxInvoiceSettings(actor:string,value:unknown){
 const input=settingsInput.parse(value);
 const registeredOn=input.registeredOn?dayStart(input.registeredOn):null;
 if(registeredOn&&registeredOn>new Date())throw Error('INVALID_VAT_REGISTRATION_DATE');
 return transaction(async tx=>{
  await userLock(tx,'tax-invoices');
  const issuer=await tx.receiptSettings.findUnique({where:{id:'active'}});
  if(input.enabled&&(!registeredOn||!issuer?.name||!issuer.address||!validThaiTaxId(issuer.taxId)))throw Error('VAT_ISSUER_REQUIRED');
  const previous=await tx.taxInvoiceSettings.findUnique({where:{id:'active'}});
  if((previous?.version??null)!==input.expectedVersion)throw Error('TAX_SETTINGS_CONFLICT');
  const data={enabled:input.enabled,registeredOn,branchCode:input.branchCode,vatRateBps:input.vatRateBps,version:randomUUID()};
  const saved=await tx.taxInvoiceSettings.upsert({where:{id:'active'},create:{id:'active',...data},update:data});
  await tx.auditLog.create({data:{actor,action:'TAX_INVOICE_SETTINGS_UPDATED',entityId:'active',details:{enabled:saved.enabled,registeredOn:registeredOn?.toISOString(),branchCode:saved.branchCode,vatRateBps:saved.vatRateBps,priceMode:'INCLUSIVE'}}});
  return saved;
 });
}

const webLineSchema=z.object({code:z.string(),name:z.string().nullable().optional(),pack:z.string(),quantity:z.number().int().positive(),lineTotalSatang:z.number().int().nonnegative()});
export async function taxInvoiceDraft(orderId:string,client:Prisma.TransactionClient=db){
 const order=await client.orderIntake.findUnique({where:{id:orderId},include:{customer:true}});
 if(!order)throw Error('TAX_ORDER_NOT_FOUND');
 const [settings,issuer,existing,website,sale]=await Promise.all([
  client.taxInvoiceSettings.findUnique({where:{id:'active'}}),
  client.receiptSettings.findUnique({where:{id:'active'}}),
  client.customerTaxInvoice.findUnique({where:{orderId}}),
  client.websiteOrder.findUnique({where:{intakeOrderId:orderId}}),
  client.salesOrder.findUnique({where:{orderId}}),
 ]);
 const totalSatang=quotedTotal(order.rawText??'')??sale?.revenueSatang??null;
 const items=orderStockItems(order.rawText).items;
 const products=items.length?await client.stockProduct.findMany({where:{code:{in:items.map(item=>item.code)}},select:{code:true,name:true}}):[];
 const names=new Map(products.map(product=>[product.code,product.name]));
 let lines:{description:string;quantity:string;grossSatang:number|null;treatment:'STANDARD'|'ZERO'|'EXEMPT'}[]=items.map(item=>({
  description:[item.code,names.get(item.code)].filter(Boolean).join(' · '),quantity:(item.quantityMilliG/1000).toLocaleString('en-US',{maximumFractionDigits:3})+' g',grossSatang:null,treatment:'STANDARD',
 }));
 const webItems=webLineSchema.array().safeParse(website?.items);
 if(website&&webItems.success&&webItems.data.length&&webItems.data.reduce((sum,item)=>sum+item.lineTotalSatang,0)+website.shippingSatang===totalSatang){
  lines=webItems.data.map(item=>({description:[item.code,item.name].filter(Boolean).join(' · '),quantity:item.quantity+' × '+item.pack,grossSatang:item.lineTotalSatang,treatment:'STANDARD'}));
  if(website.shippingSatang>0)lines.push({description:'ค่าจัดส่ง',quantity:'1',grossSatang:website.shippingSatang,treatment:'STANDARD'});
 }
 if(!lines.length)lines=[{description:'',quantity:'1',grossSatang:null,treatment:'STANDARD'}];
 const sourceVersion=sha(JSON.stringify([order.id,order.rawText,order.status,order.customerCode,order.recipient,order.address,totalSatang,website?.items,website?.shippingSatang]));
 return {
  orderId,orderNumber:order.orderNumber,orderAt:order.eventAt.toISOString(),customerCode:order.customerCode,sourceVersion,
  settingsVersion:settings?.version??null,issuerVersion:issuer?.version??null,
  enabled:!!settings?.enabled&&!!settings.registeredOn&&!!issuer&&validThaiTaxId(issuer.taxId),
  canIssue:!order.withdrawnAt&&!['CANCELLED','WITHDRAWN','EXPIRED','RETURNED','REJECTED'].includes(order.status)&&['โอน','COD'].includes(order.payment??'')&&totalSatang!==null&&totalSatang>0,
  issuer:issuer?{name:issuer.name,address:issuer.address,phone:issuer.phone,taxId:issuer.taxId,branchCode:settings?.branchCode??'00000'}:null,
  registeredOn:settings?.registeredOn?.toISOString()??null,vatRateBps:settings?.vatRateBps??700,
  buyer:{name:order.recipient||[order.customer?.title,order.customer?.name].filter(Boolean).join(' '),address:order.address||order.customer?.address||'',taxId:'',branchCode:'00000',vatRegistered:false},
  lines,totalSatang,existingInvoiceId:existing?.id??null,
 };
}
export type TaxInvoiceDraft=Awaited<ReturnType<typeof taxInvoiceDraft>>;

export const taxInvoiceSnapshotSchema=z.object({
 issuer:z.object({name:z.string(),address:z.string(),phone:z.string(),taxId:z.string(),branchCode:z.string()}),
 buyer:taxBuyerSchema,orderNumber:z.string(),priceMode:z.literal('INCLUSIVE'),vatRateBps:z.number().int(),
 lines:taxInvoiceLineSchema.extend({netSatang:z.number().int(),vatSatang:z.number().int()}).array(),
 branding:documentBrandingSchema,
});
const invoiceInput=z.object({
 orderId:z.string().min(1).max(100),sourceVersion:z.string().length(64),
 settingsVersion:z.string(),issuerVersion:z.string(),buyer:taxBuyerSchema,
 lines:taxInvoiceLineSchema.array().min(1).max(100),confirmed:z.literal(true),
});
export async function issueTaxInvoice(actor:string,value:unknown,now=new Date(),operator?:DocumentAccount){
 const input=invoiceInput.parse(value),fingerprint=sha(JSON.stringify(input));
 return transaction(async tx=>{
  await userLock(tx,'tax-invoices');
  if(operator){const order=await tx.orderIntake.findUnique({where:{id:input.orderId},select:{sellerUsername:true}});if(!order||!canAccessOrderDocument(operator,order.sellerUsername,isSeparateShopDatabase(),true))throw Error('DOCUMENT_FORBIDDEN');}
  const existing=await tx.customerTaxInvoice.findUnique({where:{orderId:input.orderId}});
  if(existing){if(existing.fingerprint!==fingerprint)throw Error('TAX_INVOICE_ALREADY_ISSUED');return existing;}
  const draft=await taxInvoiceDraft(input.orderId,tx);
  if(!draft.enabled||!draft.issuer||!draft.registeredOn||new Date(draft.registeredOn)>now)throw Error('VAT_ISSUER_REQUIRED');
  if(new Date(draft.orderAt)<new Date(draft.registeredOn))throw Error('TAX_ORDER_BEFORE_REGISTRATION');
  if(!draft.canIssue)throw Error('TAX_ORDER_NOT_ELIGIBLE');
  if(draft.sourceVersion!==input.sourceVersion||draft.settingsVersion!==input.settingsVersion||draft.issuerVersion!==input.issuerVersion)throw Error('TAX_INVOICE_CONFLICT');
  const totals=inclusiveTaxTotals(input.lines,draft.vatRateBps);
  if(totals.totalSatang!==draft.totalSatang)throw Error('TAX_INVOICE_TOTAL_MISMATCH');
  const year=Number(bangkokDay(now).slice(0,4));
  const counter=await tx.taxInvoiceCounter.upsert({where:{year},create:{year,number:1},update:{number:{increment:1}}});
  const snapshot=taxInvoiceSnapshotSchema.parse({issuer:draft.issuer,buyer:input.buyer,orderNumber:draft.orderNumber,priceMode:'INCLUSIVE',vatRateBps:draft.vatRateBps,lines:totals.lines,branding:await documentBrandingSnapshot(tx)});
  const document=await tx.customerTaxInvoice.create({data:{number:'TI-'+year+'-'+String(counter.number).padStart(6,'0'),orderId:input.orderId,customerCode:draft.customerCode,fingerprint,snapshot,netSatang:totals.netSatang,vatSatang:totals.vatSatang,totalSatang:totals.totalSatang,issuedAt:now}});
  await tx.auditLog.create({data:{actor,action:'TAX_INVOICE_ISSUED',entityId:document.id,details:{orderId:input.orderId,number:document.number,totalSatang:document.totalSatang,vatSatang:document.vatSatang,priceMode:'INCLUSIVE'}}});
  return document;
 });
}
