import {assertNoStockReservations} from './stock-flow';
import {prepareStockDailyClose} from './stock-history';
import {createHash} from 'node:crypto';import {z} from 'zod';import {db} from './db';import {stockCode} from './stock-code';import {stockDeleteFingerprint} from './stock-delete';import {stockGoogleClient,readStockSheet} from './stock-google';import type {StockRow} from './stock-import';
export const stockDeleteBatchInput=z.object({requestKey:z.uuid(),confirmation:z.string().trim().pipe(z.literal('ลบ')),items:z.array(z.object({code:stockCode,fingerprint:z.string().regex(/^[a-f0-9]{64}$/)})).min(1).max(500).refine(items=>new Set(items.map(i=>i.code)).size===items.length)});
type BatchInput=z.infer<typeof stockDeleteBatchInput>;
export const deleteBatchFingerprint=(items:BatchInput['items'])=>createHash('sha256').update(JSON.stringify([...items].sort((a,b)=>a.code.localeCompare(b.code,'en')))).digest('hex');
export function stockDeleteRanges(products:StockRow[],sheetId:number){return [...products].sort((a,b)=>b.sourceRow-a.sourceRow).map(p=>({deleteDimension:{range:{sheetId,dimension:'ROWS',startIndex:p.sourceRow-1,endIndex:p.sourceRow}}}));}
export async function deleteStockProducts(input:BatchInput,actor:string){return db.$transaction(async tx=>{
 const locks=await tx.$queryRawUnsafe<{locked:boolean}[]>('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked','stock-sheet-add');if(!locks[0]?.locked)throw Error('STOCK_BUSY');
 const fingerprint=deleteBatchFingerprint(input.items);let saved=await tx.stockDeleteBatch.findUnique({where:{id:input.requestKey}});
 if(saved&&saved.fingerprint!==fingerprint)throw Error('STOCK_REQUEST_CHANGED');
 if(saved?.status==='COMPLETED')return {deleted:true,count:input.items.length,replayed:true};
 const client=await stockGoogleClient(),key='cannexa-stock-delete-batch-'+input.requestKey;
 const metadata=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:key,visibility:'DOCUMENT'}}]})});
 const raw=metadata.matchedDeveloperMetadata?.[0]?.developerMetadata?.metadataValue;
 const finish=async(replayed:boolean)=>{if(!saved)throw Error('STOCK_DELETE_SNAPSHOT_MISSING');await tx.auditLog.createMany({data:(saved.items as unknown as StockRow[]).map(product=>({id:'stock-delete-batch:'+input.requestKey+':'+product.code,actor,action:'STOCK_PRODUCT_DELETED',entityId:product.code,details:{code:product.code,name:product.name,sourceSheet:saved!.sourceSheet,batchCount:input.items.length,snapshot:product}})),skipDuplicates:true});await tx.stockDeleteBatch.update({where:{id:input.requestKey},data:{status:'COMPLETED',completedAt:new Date()}});return {deleted:true,count:input.items.length,replayed};};
 if(raw){if(JSON.parse(raw).fingerprint!==fingerprint)throw Error('STOCK_REQUEST_CHANGED');return finish(true);}
 const source=await readStockSheet(client),products=input.items.map(item=>{const product=source.products.find(p=>p.code===item.code);if(!product)throw Error('STOCK_PRODUCT_NOT_FOUND');if(stockDeleteFingerprint(product,source.tab.title)!==item.fingerprint)throw Error('STOCK_PRODUCT_CHANGED');return product;});
 if(saved&&saved.sourceSheet!==source.tab.title)throw Error('STOCK_PRODUCT_CHANGED');
 // Commit the pre-delete snapshot independently before the external atomic write.
 // A lost Google response or an outer transaction rollback must not lose history.
 if(!saved)saved=await db.stockDeleteBatch.create({data:{id:input.requestKey,fingerprint,actor,sourceSheet:source.tab.title,items:products}});
 await assertNoStockReservations(input.items.map(i=>i.code));
 await prepareStockDailyClose(client,actor);
 await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[...stockDeleteRanges(products,source.tab.sheetId),{createDeveloperMetadata:{developerMetadata:{metadataKey:key,metadataValue:JSON.stringify({fingerprint,count:products.length,sourceSheet:source.tab.title}),location:{spreadsheet:true},visibility:'DOCUMENT'}}}]})});
 const after=await readStockSheet(client);if(after.products.some(p=>input.items.some(item=>item.code===p.code)))throw Error('STOCK_DELETE_NOT_CONFIRMED');
 return finish(false);
 },{timeout:55000,maxWait:10000});}
