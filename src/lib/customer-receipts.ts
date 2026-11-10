import {canAccessOrderDocument,type DocumentAccount} from './order-document-access';
import {isSeparateShopDatabase} from './db';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,transaction,userLock} from './db';
import {quotedTotal} from './shipment-matching';
import {orderStockItems} from './order-stock-items';
import {receiptPaymentAmount} from './receipt-payment';
import {documentBrandingSchema,documentBrandingSnapshot} from './document-branding';

export const receiptSnapshotSchema=z.object({
 issuer:z.object({name:z.string(),address:z.string(),phone:z.string(),taxId:z.string()}),
 customer:z.object({name:z.string(),address:z.string(),code:z.string().nullable()}),
 orderNumber:z.string(),payment:z.string(),
 items:z.array(z.object({description:z.string(),quantity:z.string()})),
 branding:documentBrandingSchema.optional(),
});
export type ReceiptSnapshot=z.infer<typeof receiptSnapshotSchema>;
export const receiptSettingsSchema=z.object({name:z.string().trim().min(1).max(200),address:z.string().trim().min(1).max(2000),phone:z.string().trim().max(100),taxId:z.string().trim().regex(/^(?:\d{13})?$/),enabled:z.boolean(),expectedVersion:z.string().nullable()});

export async function saveReceiptSettings(actor:string,input:unknown){
 const {expectedVersion,...data}=receiptSettingsSchema.parse(input);
 return transaction(async tx=>{
  await userLock(tx,'receipt-settings');
  const previous=await tx.receiptSettings.findUnique({where:{id:'active'}});
  if((previous?.version??null)!==expectedVersion)throw Error('RECEIPT_SETTINGS_CONFLICT');
  const settings=await tx.receiptSettings.upsert({where:{id:'active'},create:{id:'active',...data},update:{...data,version:randomUUID()}});
  await tx.auditLog.create({data:{actor,action:'RECEIPT_SETTINGS_UPDATED',entityId:'active',details:{enabled:data.enabled}}});
  return settings;
 });
}

export async function issueCustomerReceipt(orderId:string,actor:string,customerCode?:string,operator?:DocumentAccount){
 return transaction(async tx=>{
  await userLock(tx,'customer-receipts');
  const order=await tx.orderIntake.findUnique({where:{id:orderId},include:{customer:true}});
  if(operator&&order&&!canAccessOrderDocument(operator,order.sellerUsername,isSeparateShopDatabase(),true))throw Error('DOCUMENT_FORBIDDEN');
  if(!order||customerCode!==undefined&&order.customerCode!==customerCode)throw Error('RECEIPT_NOT_FOUND');
  const existing=await tx.customerReceipt.findUnique({where:{orderId}});
  if(existing){
   if(customerCode!==undefined&&existing.customerCode!==customerCode)throw Error('RECEIPT_NOT_FOUND');
   return existing;
  }
  const settings=await tx.receiptSettings.findUnique({where:{id:'active'}});
  if(!settings?.enabled||!settings.name||!settings.address)throw Error('RECEIPT_NOT_CONFIGURED');
  const shipment=await tx.shipment.findUnique({where:{orderId}});
  const cod=shipment?await tx.codReceipt.findUnique({where:{tracking:shipment.tracking}}):null;
  const sale=await tx.salesOrder.findUnique({where:{orderId}});
  const amount=receiptPaymentAmount(order,quotedTotal(order.rawText??'')??sale?.revenueSatang??null,shipment,cod?.amountSatang??null);
  if(amount===null)throw Error('RECEIPT_PAYMENT_PENDING');
  const parsed=orderStockItems(order.rawText);
  const products=parsed.items.length?await tx.stockProduct.findMany({where:{code:{in:parsed.items.map(item=>item.code)}},select:{code:true,name:true}}):[];
  const names=new Map(products.map(product=>[product.code,product.name]));
  const snapshot:ReceiptSnapshot={
   issuer:{name:settings.name,address:settings.address,phone:settings.phone,taxId:settings.taxId},
   customer:{name:order.recipient||[order.customer?.title,order.customer?.name].filter(Boolean).join(' ')||'ลูกค้า',address:order.address||order.customer?.address||'',code:order.customerCode},
   orderNumber:order.orderNumber,payment:order.payment==='COD'?'COD':'TRANSFER',
   items:parsed.items.map(item=>({description:[item.code,names.get(item.code)].filter(Boolean).join(' · '),quantity:(item.quantityMilliG/1000).toLocaleString('en-US',{maximumFractionDigits:3})+' g'})),
   branding:await documentBrandingSnapshot(tx),
  };
  // Legacy orders may not contain parseable item lines. Keep their source order reference and total.
  if(!snapshot.items.length)snapshot.items.push({description:'สินค้าและค่าจัดส่งตามออเดอร์ '+order.orderNumber,quantity:'1'});
  const issuedAt=new Date();
  const year=Number(issuedAt.toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok',year:'numeric'}));
  const counter=await tx.receiptCounter.upsert({where:{year},create:{year,number:1},update:{number:{increment:1}}});
  const receipt=await tx.customerReceipt.create({data:{number:'RC-'+year+'-'+String(counter.number).padStart(6,'0'),orderId,customerCode:order.customerCode,amountSatang:amount,snapshot,issuedAt}});
  await tx.auditLog.create({data:{actor,action:'CUSTOMER_RECEIPT_ISSUED',entityId:receipt.id,details:{orderId,number:receipt.number,amountSatang:amount}}});
  return receipt;
 });
}
