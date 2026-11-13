import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {db,transaction,userLock} from './db';
import {stockCode} from './stock-code';
import {readStockSheet} from './stock-google';

// Separate from merchandising settings so editing categories cannot reopen products.
export const stockSaleAvailabilityId='stock-sale-availability';
const entriesSchema=z.array(z.object({code:stockCode,enabled:z.boolean(),version:z.uuid()})).max(10000)
 .refine(entries=>new Set(entries.map(entry=>entry.code)).size===entries.length);
export const stockSaleAvailabilityInput=z.object({code:stockCode,enabled:z.boolean(),version:z.string().max(100).default('')});
export async function loadStockSaleAvailability(client:Prisma.TransactionClient=db){
 const row=await client.shopCatalogSettings.findUnique({where:{id:stockSaleAvailabilityId}});
 if(!row)return [];
 const parsed=entriesSchema.safeParse(row.products);
 if(!parsed.success)throw Error('STOCK_AVAILABILITY_INVALID');
 return parsed.data;
}
export async function saveStockSaleAvailability(actor:string,value:unknown,read:typeof readStockSheet=readStockSheet){
 const input=stockSaleAvailabilityInput.parse(value);
 return transaction(async tx=>{
  // Use the order-admission lock: a closure takes effect before any later new order.
  await userLock(tx,'stock-sheet-add');
  const source=await read();
  if(!source.products.some(product=>product.code===input.code))throw Error('STOCK_PRODUCT_NOT_FOUND');
  const entries=await loadStockSaleAvailability(tx),before=entries.find(entry=>entry.code===input.code);
  if(before?.enabled===input.enabled)return {code:input.code,enabled:before.enabled,version:before.version};
  if((before?.version??'')!==input.version)throw Error('STOCK_AVAILABILITY_CHANGED');
  const version=randomUUID(),next={code:input.code,enabled:input.enabled,version};
  const products=[...entries.filter(entry=>entry.code!==input.code),next];
  await tx.shopCatalogSettings.upsert({where:{id:stockSaleAvailabilityId},create:{id:stockSaleAvailabilityId,products,version},update:{products,version}});
  await tx.auditLog.create({data:{actor,action:'STOCK_SALE_AVAILABILITY_CHANGED',entityId:input.code,details:{before:before?.enabled??true,after:input.enabled}}});
  return next;
 });
}
export function pausedStockReasons(codes:string[],entries:Awaited<ReturnType<typeof loadStockSaleAvailability>>){
 const paused=new Set(entries.filter(entry=>!entry.enabled).map(entry=>entry.code));
 return [...new Set(codes)].filter(code=>paused.has(code)).map(code=>'สินค้า '+code+' ไม่พร้อมขาย');
}
