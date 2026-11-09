import {Prisma} from '@prisma/client';
import {db} from './db';
import {remoteStockGoogleClient} from './stock-google';
import {latestStockTab} from './stock-product-input';
import {stockRows} from './stock-import';
import {STOCK_COMPLETED_HEADER} from './stock-flow-plan';
import {stockAvailableFormula} from './stock-available';
import {workbookSheet,workbookValues,type StockWorkbookState,type WorkbookCell,type WorkbookSheet} from './stock-workbook-state';

const json=(value:unknown)=>value as Prisma.InputJsonValue;
function range(sheet:WorkbookSheet){
 let column='';for(let number=sheet.properties.gridProperties.columnCount;number>0;number=Math.floor((number-1)/26))column=String.fromCharCode(65+(number-1)%26)+column;
 return "'"+sheet.properties.title.replace(/'/g,"''")+"'!A1:"+column+Math.max(sheet.properties.gridProperties.rowCount,1);
}

export function stockReadOnlyProtectionRequests(sheets:any[],managedIds:number[],email:string){
 return sheets.filter(sheet=>managedIds.includes(sheet.properties.sheetId)).map(sheet=>{
  const existing=sheet.protectedRanges?.find((range:any)=>range.description==='Cannexa: managed by system');
  const protection={range:{sheetId:sheet.properties.sheetId},description:'Cannexa: managed by system',warningOnly:false,editors:{users:[email],groups:[],domainUsersCanEdit:false},unprotectedRanges:[]};
  return existing?{updateProtectedRange:{protectedRange:{...protection,protectedRangeId:existing.protectedRangeId},fields:'range,description,warningOnly,editors,unprotectedRanges'}}:{addProtectedRange:{protectedRange:protection}};
 });
}

export async function activateStockWorkbook(actor:string){
 return db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
  if(await tx.stockWorkbook.findUnique({where:{id:'active'}}))return {replayed:true};
  const client=await remoteStockGoogleClient();
  const metadata=await client('?fields=sheets(properties,developerMetadata),developerMetadata');
  const primary=latestStockTab(metadata.sheets.map((s:any)=>s.properties));
  const sheets:WorkbookSheet[]=metadata.sheets.filter((s:any)=>s.properties.sheetId===primary.sheetId||/^(จัดส่ง |รับคืน |ปิดยอด |ก่อนเริ่มรอบ )/.test(s.properties.title)).map((s:any)=>({properties:s.properties,rows:[]}));
  if(sheets.some(s=>s.properties.gridProperties.rowCount>10000))throw Error('STOCK_SYSTEM_IMPORT_TOO_LARGE');
  const params=new URLSearchParams({valueRenderOption:'UNFORMATTED_VALUE'});for(const sheet of sheets)params.append('ranges',range(sheet));
  const values=await client('/values:batchGet?'+params);
  params.set('valueRenderOption','FORMULA');const formulas=await client('/values:batchGet?'+params);
  for(const [index,sheet]of sheets.entries()){
   const numbers:WorkbookCell[][]=values.valueRanges?.[index]?.values??[];
   const expressions:WorkbookCell[][]=formulas.valueRanges?.[index]?.values??[];
   sheet.rows=Array.from({length:Math.max(numbers.length,expressions.length)},(_,i)=>Array.from({length:Math.max(numbers[i]?.length??0,expressions[i]?.length??0)},(_,j)=>{
    const expression=expressions[i]?.[j];
    if(sheet.properties.sheetId===primary.sheetId&&typeof expression==='string'&&expression.startsWith('=')){
     if(j===6)return numbers[0]?.[12]===STOCK_COMPLETED_HEADER?'=INDEX(E:E,ROW())-INDEX(M:M,ROW())':'=INDEX(E:E,ROW())-INDEX(F:F,ROW())';
     if(j===13)return stockAvailableFormula;
    }
    return numbers[i]?.[j]??null;
   }));
  }
  const main=sheets.find(s=>s.properties.sheetId===primary.sheetId)!;
  if(main.rows[0]?.[2]!=='รายการ'||main.rows[0]?.[4]!=='จำนวนรับ'||!['จำนวนจ่าย','จำนวนรอจ่าย'].includes(String(main.rows[0]?.[5]))||main.rows[0]?.[6]!=='จำนวนคงเหลือ')throw Error('STOCK_HEADERS_CHANGED');
  const imported=stockRows(values.valueRanges[sheets.indexOf(main)]?.values??[],{costColumnConfirmed:true});
  const stored=stockRows(workbookValues(main),{costColumnConfirmed:true});
  if(JSON.stringify(imported)!==JSON.stringify(stored))throw Error('STOCK_SYSTEM_IMPORT_MISMATCH');
  const state:StockWorkbookState={activeSheetId:primary.sheetId,sheets,metadata:[...(metadata.developerMetadata??[]),...metadata.sheets.flatMap((s:any)=>s.developerMetadata??[])],pending:[]};
  await tx.stockWorkbook.create({data:{id:'active',state:json(state),dirty:false,syncedAt:new Date()}});
  await tx.stockSheetsConnection.update({where:{id:'active'},data:{systemPrimary:true}});
  await tx.auditLog.create({data:{actor,action:'STOCK_SYSTEM_ACTIVATED',entityId:'stock',details:{sourceSheet:primary.title,products:stockRows(workbookValues(main),{costColumnConfirmed:true}).length}}});
  return {replayed:false};
 },{timeout:55000,maxWait:10000});
}

function belongsToPrimary(request:Record<string,any>,sheetId:number){
 const value=Object.values(request)[0] as any;
 return [value?.sheetId,value?.start?.sheetId,value?.range?.sheetId,value?.properties?.sheetId,value?.filter?.range?.sheetId,value?.protectedRange?.range?.sheetId,value?.developerMetadata?.location?.sheetId].includes(sheetId);
}
function archiveRequests(requests:Record<string,any>[],sheetId:number){
 return requests.filter(request=>!belongsToPrimary(request,sheetId)&&!request.deleteDeveloperMetadata&&!(request.createDeveloperMetadata?.developerMetadata.location?.spreadsheet)&&!request.addProtectedRange);
}

export async function syncStockWorkbook(){
 const initial=await db.stockWorkbook.findUnique({where:{id:'active'}});if(!initial)return {active:false};
 const now=new Date(),lease=await db.stockWorkbook.updateMany({where:{id:'active',OR:[{syncLeaseUntil:null},{syncLeaseUntil:{lte:now}}]},data:{syncLeaseUntil:new Date(+now+120000)}});
 if(!lease.count)return {active:true,busy:true};
 try{
  const client=await remoteStockGoogleClient();
  const saved=await db.stockWorkbook.findUniqueOrThrow({where:{id:'active'}});
  const state=saved.state as unknown as StockWorkbookState;
  const primary=workbookSheet(state,state.activeSheetId);
  const remoteResult=await client('/values/'+encodeURIComponent(range(primary))+'?valueRenderOption=UNFORMATTED_VALUE');
  const remoteRows:WorkbookCell[][]=remoteResult.values??[];
  const sentVersion=saved.version,main=workbookSheet(state,state.activeSheetId),processed:string[]=[],syncKeys:string[]=[];
  for(const batch of state.pending.slice(0,15)){
   const requests=archiveRequests(batch.requests,state.activeSheetId);
   if(requests.length){
    const key='system-sync-'+batch.id;
    const found=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:key,visibility:'DOCUMENT'}}]})});
    if(!found.matchedDeveloperMetadata?.length)await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[...requests,{createDeveloperMetadata:{developerMetadata:{metadataKey:key,metadataValue:'applied',location:{spreadsheet:true},visibility:'DOCUMENT'}}}]})});
    syncKeys.push(key);
   }
   processed.push(batch.id);
  }
  {
   const width=Math.max(16,main.properties.gridProperties.columnCount),height=Math.max(main.rows.length,remoteRows.length,1);
   const requests:Record<string,unknown>[]=[{updateSheetProperties:{properties:{sheetId:state.activeSheetId,gridProperties:{rowCount:Math.max(height,main.properties.gridProperties.rowCount),columnCount:width}},fields:'gridProperties.rowCount,gridProperties.columnCount'}},{updateCells:{range:{sheetId:state.activeSheetId,startRowIndex:0,endRowIndex:height,startColumnIndex:0,endColumnIndex:width},rows:main.rows.map(row=>({values:row.map((value,column)=>({userEnteredValue:value===null?undefined:typeof value==='number'?{numberValue:value}:typeof value==='boolean'?{boolValue:value}:[6,13].includes(column)&&value.startsWith('=')?{formulaValue:value}:{stringValue:value}}))})),fields:'userEnteredValue'}}];
   await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests})});
  }
  const connection=await db.stockSheetsConnection.findUniqueOrThrow({where:{id:'active'},select:{email:true}});
  const metadata=await client('?fields=sheets(properties,protectedRanges)');
  const protections=stockReadOnlyProtectionRequests(metadata.sheets??[],(metadata.sheets??[]).map((sheet:any)=>sheet.properties.sheetId),connection.email);
  if(protections.length)await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:protections})});
  const verified=await client('?fields=sheets(properties(sheetId),protectedRanges)');
  if(verified.sheets.some((sheet:any)=>!sheet.protectedRanges?.some((protection:any)=>protection.description==='Cannexa: managed by system'&&protection.warningOnly!==true&&protection.editors?.users?.includes(connection.email))))throw Error('STOCK_SHEET_PROTECTION_NOT_CONFIRMED');
  const copied=await client('/values/'+encodeURIComponent(range(primary))+'?valueRenderOption=UNFORMATTED_VALUE');
  const expectedProducts=stockRows(workbookValues(main),{costColumnConfirmed:true}),copiedProducts=stockRows(copied.values??[],{costColumnConfirmed:true});
  const normalized=(value:unknown)=>JSON.stringify(value,(_key,item)=>typeof item==='number'?Math.round(item*1000000)/1000000:item);
  if(normalized(expectedProducts)!==normalized(copiedProducts))throw Error('STOCK_SHEET_COPY_NOT_CONFIRMED');
  for(let attempt=0;attempt<5;attempt++){
   const current=await db.stockWorkbook.findUniqueOrThrow({where:{id:'active'}}),next=current.state as unknown as StockWorkbookState;
   next.pending=next.pending.filter(batch=>!processed.includes(batch.id));
   const update=await db.stockWorkbook.updateMany({where:{id:'active',version:current.version},data:{state:json(next),version:{increment:1},dirty:current.version!==sentVersion||next.pending.length>0,syncedAt:new Date(),syncError:null}});
   if(update.count){
    if(syncKeys.length)await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:syncKeys.map(metadataKey=>({deleteDeveloperMetadata:{dataFilter:{developerMetadataLookup:{metadataKey,visibility:'DOCUMENT'}}}}))})}).catch(()=>{});
    return {active:true,synced:true,pending:next.pending.length};
   }
  }
  throw Error('STOCK_SYSTEM_BUSY');
 }catch(error){
  const message=error instanceof Error?error.message:'';
  const code=/^[A-Z_]+$/.test(message)?message:'STOCK_SYNC_FAILED';
  await db.stockWorkbook.update({where:{id:'active'},data:{syncError:code}});
  return {active:true,synced:false,error:code};
 }finally{await db.stockWorkbook.update({where:{id:'active'},data:{syncLeaseUntil:null}});}
}
