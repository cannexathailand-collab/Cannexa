import {createHash} from 'node:crypto';
import type {StockClient} from './stock-flow-operation';
import type {StockOutSnapshot} from './stock-dispatch-plan';
import {bangkokDay} from './sales-dates';
const balanceHeaders=['ยอดตั้งต้นขณะเก็บประวัติ (G)','ยอดยกมาที่คำนวณ (G)','คงเหลือขณะเก็บประวัติ (G)','คงเหลือหลังตัดที่คำนวณ (G)'];
export function shipmentArchive(snapshot:StockOutSnapshot,savedAt:Date){
 const title=snapshot.orderRoundDay?'จัดส่ง รอบ '+snapshot.orderRoundDay:'จัดส่ง '+bangkokDay(savedAt),sheetId=parseInt(createHash('sha256').update(title).digest('hex').slice(0,7),16)+1;
 const time=(d:Date)=>d.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
 const columnCount=snapshot.items.some(i=>i.receivedBefore!==undefined||i.receivedAfter!==undefined)?14:10;
 // Legacy rows keep their exact shape and fingerprint for saved-marker retries.
 const rows=snapshot.items.map(i=>[time(savedAt),time(new Date(snapshot.dispatchedAt)),snapshot.orderNumber,snapshot.tracking,i.code,i.name??'',i.quantityMilliG/1000,i.unitCostSatang/100,i.costSatang/100,snapshot.orderId,...(columnCount===14?[i.receivedBefore??'',i.receivedAfter??'',i.remainingBefore,i.remainingAfter]:[])]);
 const key='stock-shipment-'+createHash('sha256').update(snapshot.orderId).digest('hex').slice(0,32),fingerprint=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 return {title,sheetId,rows,key,fingerprint,columnCount};
}
// This archive must be confirmed before the live stock operation is permitted.
export async function saveShipmentArchive(client:StockClient,snapshot:StockOutSnapshot,savedAt:Date){
 const a=shipmentArchive(snapshot,savedAt),metadata=await client('?fields=sheets(properties(sheetId,title,gridProperties(columnCount)))');
 let sheet=metadata.sheets?.find((s:any)=>s.properties.title===a.title)?.properties;
 const found=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:a.key,visibility:'DOCUMENT'}}]})});
 const marker=found.matchedDeveloperMetadata?.[0]?.developerMetadata;
 if(marker&&marker.metadataValue!==a.fingerprint)throw Error('STOCK_HISTORY_CONFLICT');
 if(!sheet){
  if(metadata.sheets?.some((s:any)=>s.properties.sheetId===a.sheetId))throw Error('STOCK_HISTORY_CONFLICT');
  const headers=['บันทึกก่อนตัดสต๊อก','จัดส่งจริง','ออเดอร์','เลขพัสดุ','รหัสสินค้า','ชื่อสินค้า','จำนวน (G)','ต้นทุน (บาท/G)','ต้นทุนรวม (บาท)','รายการอ้างอิง',...balanceHeaders];
  await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
   {addSheet:{properties:{sheetId:a.sheetId,title:a.title,gridProperties:{rowCount:1000,columnCount:14,frozenRowCount:1}}}},
   {updateCells:{start:{sheetId:a.sheetId,rowIndex:0,columnIndex:0},rows:[{values:headers.map(stringValue=>({userEnteredValue:{stringValue}}))}],fields:'userEnteredValue'}},
   {repeatCell:{range:{sheetId:a.sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:0.85,green:0.92,blue:1},textFormat:{bold:true},wrapStrategy:'WRAP'}},fields:'userEnteredFormat'}},
   {updateDimensionProperties:{range:{sheetId:a.sheetId,dimension:'COLUMNS',startIndex:0,endIndex:14},properties:{pixelSize:160},fields:'pixelSize'}},
   {updateDimensionProperties:{range:{sheetId:a.sheetId,dimension:'COLUMNS',startIndex:9,endIndex:10},properties:{hiddenByUser:true},fields:'hiddenByUser'}},
   {addProtectedRange:{protectedRange:{range:{sheetId:a.sheetId},warningOnly:true,description:'ประวัติการจัดส่งก่อนตัดสต๊อก'}}}
  ]})});sheet={sheetId:a.sheetId,gridProperties:{columnCount:14}};
 }else if(a.columnCount===14&&(sheet.gridProperties?.columnCount??10)<14){
  // Extend only the header and grid; previously archived data rows remain untouched.
  await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
   {updateSheetProperties:{properties:{sheetId:sheet.sheetId,gridProperties:{columnCount:14}},fields:'gridProperties.columnCount'}},
   {updateCells:{start:{sheetId:sheet.sheetId,rowIndex:0,columnIndex:10},rows:[{values:balanceHeaders.map(stringValue=>({userEnteredValue:{stringValue}}))}],fields:'userEnteredValue'}},
   {repeatCell:{range:{sheetId:sheet.sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:10,endColumnIndex:14},cell:{userEnteredFormat:{backgroundColor:{red:0.85,green:0.92,blue:1},textFormat:{bold:true},wrapStrategy:'WRAP'}},fields:'userEnteredFormat'}},
   {updateDimensionProperties:{range:{sheetId:sheet.sheetId,dimension:'COLUMNS',startIndex:10,endIndex:14},properties:{pixelSize:160},fields:'pixelSize'}}
  ]})});
 }
 if(!marker)await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
  {appendCells:{sheetId:sheet.sheetId,rows:a.rows.map(row=>({values:row.map(v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:v}}))})),fields:'userEnteredValue'}},
  {createDeveloperMetadata:{developerMetadata:{metadataKey:a.key,metadataValue:a.fingerprint,location:{sheetId:sheet.sheetId},visibility:'DOCUMENT'}}}
 ]})});
 const read=await client('/values/'+encodeURIComponent("'"+a.title+"'!A:"+(a.columnCount===14?'N':'J'))+'?valueRenderOption=UNFORMATTED_VALUE');
 const actual=(read.values??[]).filter((r:unknown[])=>r[9]===snapshot.orderId).map((r:unknown[])=>Array.from({length:a.columnCount},(_,i)=>r[i]??''));
 if(JSON.stringify(actual)!==JSON.stringify(a.rows))throw Error('STOCK_HISTORY_NOT_CONFIRMED');
 return sheet.sheetId as number;
}
