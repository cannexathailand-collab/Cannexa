import {createHash} from 'node:crypto';import {z} from 'zod';import {db} from './db';import {stockCode} from './stock-code';import {stockGoogleClient,readStockSheet} from './stock-google';
export const stockCostUpdate=z.object({requestKey:z.uuid(),code:stockCode,expectedCostSatang:z.number().int().nonnegative().nullable(),cost:z.coerce.number().finite().min(0).max(21474836.47).refine(n=>Math.abs(n*100-Math.round(n*100))<0.00001)});
export async function updateStockCost(input:z.infer<typeof stockCostUpdate>,actor:string){return db.$transaction(async tx=>{
 await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
 const client=await stockGoogleClient(),key='cannexa-stock-cost-'+input.requestKey,fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const audit=async(details:any)=>tx.auditLog.upsert({where:{id:'stock-cost:'+input.requestKey},create:{id:'stock-cost:'+input.requestKey,actor,action:'STOCK_COST_UPDATED',entityId:input.code,details},update:{}});
 const metadata=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:key,visibility:'DOCUMENT'}}]})});
 const raw=metadata.matchedDeveloperMetadata?.[0]?.developerMetadata?.metadataValue;
 if(raw){const saved=JSON.parse(raw);if(saved.fingerprint!==fingerprint)throw Error('STOCK_REQUEST_CHANGED');await audit(saved);return {replayed:true};}
 const source=await readStockSheet(client),product=source.products.find(p=>p.code===input.code);if(!product)throw Error('STOCK_PRODUCT_NOT_FOUND');if(product.costSatang!==input.expectedCostSatang)throw Error('STOCK_PRODUCT_CHANGED');
 const costSatang=Math.round(input.cost*100),details={code:input.code,sourceSheet:source.tab.title,before:{costSatang:product.costSatang},after:{costSatang},fingerprint,updatedAt:new Date().toISOString()};
 await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{updateCells:{start:{sheetId:source.tab.sheetId,rowIndex:product.sourceRow-1,columnIndex:3},rows:[{values:[{userEnteredValue:{numberValue:input.cost}}]}],fields:'userEnteredValue'}},{createDeveloperMetadata:{developerMetadata:{metadataKey:key,metadataValue:JSON.stringify(details),location:{spreadsheet:true},visibility:'DOCUMENT'}}}]})});
 const after=await readStockSheet(client);if(after.products.find(p=>p.code===input.code)?.costSatang!==costSatang)throw Error('STOCK_WRITE_NOT_CONFIRMED');await audit(details);return {replayed:false};
 },{timeout:55000,maxWait:10000});}
