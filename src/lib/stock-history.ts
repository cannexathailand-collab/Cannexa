import type {Prisma} from '@prisma/client';
import {db} from './db';
import {readStockSheet,stockGoogleClient} from './stock-google';
import {stockClosingDay,stockHistorySnapshot,stockHistoryRequests,stockHistoryValuesMatch} from './stock-history-plan';

type Client=Awaited<ReturnType<typeof stockGoogleClient>>;
// The caller holds the same advisory lock as every stock writer. Save outside its
// transaction so a later failed stock mutation cannot roll back the closing record.
export async function prepareStockDailyClose(client:Client,actor:string,now=new Date()){
 const config=await db.stockHistoryConfig.findUnique({where:{id:'active'}});
 if(!config?.enabled)return null;
 const day=stockClosingDay(config.startDay,now);
 if(!day)return null;
 const existing=await db.stockDailySnapshot.findUnique({where:{day}});
 if(existing)return existing;
 const source=await readStockSheet(client),snapshot=stockHistorySnapshot(day,source,actor);
 return db.stockDailySnapshot.create({data:{...snapshot,rows:snapshot.rows as Prisma.InputJsonValue,products:snapshot.products as Prisma.InputJsonValue}});
}

export async function exportStockDailySnapshot(client:Client,snapshot:Awaited<ReturnType<typeof prepareStockDailyClose>>){
 if(!snapshot||snapshot.status==='COMPLETE')return snapshot;
 const metadata=await client('?fields=sheets(properties(sheetId,title),developerMetadata)');
 const existing=metadata.sheets?.find((s:any)=>s.properties.sheetId===snapshot.sheetId||s.properties.title===snapshot.sheetTitle);
 if(existing){
  if(existing.properties.sheetId!==snapshot.sheetId||existing.properties.title!==snapshot.sheetTitle||!existing.developerMetadata?.some((m:any)=>m.metadataKey==='cannexa-stock-close'&&m.metadataValue===snapshot.fingerprint))throw Error('STOCK_HISTORY_CONFLICT');
 }else{
  await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:stockHistoryRequests({...snapshot,rows:snapshot.rows as unknown[][]})})});
 }
 const result=await client('/values/'+encodeURIComponent("'"+snapshot.sheetTitle+"'!A1:"+((snapshot.rows as unknown[][])[0]?.length>12?'N':'L')+(snapshot.rows as unknown[][]).length)+'?valueRenderOption=UNFORMATTED_VALUE');
 if(!stockHistoryValuesMatch(snapshot.rows as unknown[][],result.values??[]))throw Error('STOCK_HISTORY_NOT_CONFIRMED');
 return db.$transaction(async tx=>{
  const saved=await tx.stockDailySnapshot.update({where:{day:snapshot.day},data:{status:'COMPLETE',exportedAt:new Date()}});
  await tx.auditLog.upsert({where:{id:'stock-close:'+snapshot.day},create:{id:'stock-close:'+snapshot.day,actor:snapshot.actor,action:'STOCK_DAY_CLOSED',entityId:snapshot.day,details:{day:snapshot.day,sourceSheet:snapshot.sourceSheet,historySheet:snapshot.sheetTitle,count:(snapshot.products as unknown[]).length,capturedAt:snapshot.capturedAt.toISOString()}},update:{}});
  return saved;
 });
}

export async function closeStockDay(actor:string){
 return db.$transaction(async tx=>{
  const locks=await tx.$queryRawUnsafe<{locked:boolean}[]>('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked','stock-sheet-add');
  if(!locks[0]?.locked)throw Error('STOCK_BUSY');
  const client=await stockGoogleClient();
  const captured=await prepareStockDailyClose(client,actor);
  const pending=await db.stockDailySnapshot.findFirst({where:{status:'PENDING'},orderBy:{day:'asc'}});
  const exported=await exportStockDailySnapshot(client,pending);
  return {day:captured?.day??null,exportedDay:exported?.day??null};
 },{timeout:55000,maxWait:10000});
}
