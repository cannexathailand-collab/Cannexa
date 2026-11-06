import {createHash} from 'node:crypto';
import {db} from './db';
import {readStockSheet,stockGoogleClient} from './stock-google';
import {prepareStockDailyClose} from './stock-history';
import {verifyFlowPlan,type FlowPlan} from './stock-flow-plan';
import {stockHistoryRequests,stockHistoryValuesMatch} from './stock-history-plan';
export type StockClient=Awaited<ReturnType<typeof stockGoogleClient>>;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function archiveFlowBaseline(client:StockClient,archive:any){
 const meta=await client('?fields=sheets(properties(sheetId,title),developerMetadata)');
 const found=meta.sheets?.find((s:any)=>s.properties.sheetId===archive.sheetId||s.properties.title===archive.sheetTitle);
 if(found){if(found.properties.sheetId!==archive.sheetId||!found.developerMetadata?.some((m:any)=>m.metadataValue===archive.fingerprint))throw Error('STOCK_HISTORY_CONFLICT');}
 else await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:stockHistoryRequests(archive)})});
 const values=await client('/values/'+encodeURIComponent("'"+archive.sheetTitle+"'!A1:L"+archive.rows.length)+'?valueRenderOption=UNFORMATTED_VALUE');
 if(!stockHistoryValuesMatch(archive.rows,values.values??[]))throw Error('STOCK_HISTORY_NOT_CONFIRMED');
}
// Caller owns stock-sheet-add. Commit recovery data outside that transaction.
export async function applyFlowOperation(client:StockClient,id:string,kind:string,actor:string,build:(saved:any)=>Promise<FlowPlan&Record<string,any>>){
 let saved=await db.stockSheetOperation.findUnique({where:{id}});
 if(saved?.status==='APPLIED')return saved.snapshot as any;
 const key='stock-flow-'+hash(id).slice(0,32);
 const markers=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:key,visibility:'DOCUMENT'}}]})});
 const marker=markers.matchedDeveloperMetadata?.[0]?.developerMetadata?.metadataValue;
 if(marker){
  if(!saved||marker!==saved.fingerprint)throw Error('STOCK_OPERATION_CONFLICT');
 }else{
  const plan=await build(saved?.snapshot),fingerprint=hash(plan);
  saved=await db.stockSheetOperation.upsert({where:{id},create:{id,kind,sourceSheet:plan.sourceSheet,snapshot:plan as any,fingerprint},update:{snapshot:plan as any,fingerprint,sourceSheet:plan.sourceSheet}});
  await prepareStockDailyClose(client,actor);
  if(plan.archive)await archiveFlowBaseline(client,plan.archive);
  await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[...plan.requests,{createDeveloperMetadata:{developerMetadata:{metadataKey:key,metadataValue:fingerprint,location:{spreadsheet:true},visibility:'DOCUMENT'}}}]})});
  if(!verifyFlowPlan(plan,await readStockSheet(client)))throw Error('STOCK_WRITE_NOT_CONFIRMED');
 }
 await db.stockSheetOperation.update({where:{id},data:{status:'APPLIED',appliedAt:new Date()}});
 // APPLIED is durable, so retries no longer depend on the temporary marker.
 await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{deleteDeveloperMetadata:{dataFilter:{developerMetadataLookup:{metadataKey:key,visibility:'DOCUMENT'}}}}]})}).catch(()=>{});
 return saved!.snapshot as any;
}
