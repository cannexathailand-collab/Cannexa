import {createHash} from 'node:crypto';import {db} from './db';import {stockGoogleClient,readStockSheet} from './stock-google';import type {StockFormProduct} from './stock-form-match';
export function stockDeleteFingerprint(product:StockFormProduct,sourceSheet:string){const {code,name,costSatang,receivedQuantity,issuedQuantity,remainingQuantity,salePrices}=product;return createHash('sha256').update(JSON.stringify({code,name,costSatang,receivedQuantity,issuedQuantity,remainingQuantity,salePrices,sourceSheet})).digest('hex');}
export async function deleteStockProduct(input:{requestKey:string;code:string;fingerprint:string},actor:string){return db.$transaction(async tx=>{
 await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
 const client=await stockGoogleClient(),key='cannexa-stock-delete-'+input.requestKey;
 const audit=async(details:Record<string,unknown>)=>tx.auditLog.upsert({where:{id:'stock-delete:'+input.requestKey},create:{id:'stock-delete:'+input.requestKey,actor,action:'STOCK_PRODUCT_DELETED',entityId:input.code,details:details as any},update:{}});
 const previous=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:key,visibility:'DOCUMENT'}}]})});
 const raw=previous.matchedDeveloperMetadata?.[0]?.developerMetadata?.metadataValue;
 if(raw){const saved=JSON.parse(raw);if(saved.code!==input.code||saved.fingerprint!==input.fingerprint)throw new Error('STOCK_REQUEST_CHANGED');await audit(saved);return {code:input.code,deleted:true,replayed:true};}
 const source=await readStockSheet(client),product=source.products.find(p=>p.code===input.code);
 if(!product)throw new Error('STOCK_PRODUCT_NOT_FOUND');
 if(stockDeleteFingerprint(product,source.tab.title)!==input.fingerprint)throw new Error('STOCK_PRODUCT_CHANGED');
 const details={code:input.code,name:product.name,sourceSheet:source.tab.title,fingerprint:input.fingerprint,deletedAt:new Date().toISOString(),snapshot:product};
 await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{deleteDimension:{range:{sheetId:source.tab.sheetId,dimension:'ROWS',startIndex:product.sourceRow-1,endIndex:product.sourceRow}}},{createDeveloperMetadata:{developerMetadata:{metadataKey:key,metadataValue:JSON.stringify(details),location:{spreadsheet:true},visibility:'DOCUMENT'}}}]})});
 const after=await readStockSheet(client);if(after.products.some(p=>p.code===input.code))throw new Error('STOCK_DELETE_NOT_CONFIRMED');
 await audit(details);return {code:input.code,deleted:true,replayed:false};
},{timeout:55000,maxWait:10000});}
