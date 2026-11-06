import {createHash} from 'node:crypto';
import type {StockClient} from './stock-flow-operation';
import type {StockOutSnapshot} from './stock-dispatch-plan';
import {bangkokDay} from './sales-dates';
export function shipmentArchive(snapshot:StockOutSnapshot,savedAt:Date){
 const title='จัดส่ง '+bangkokDay(savedAt),sheetId=parseInt(createHash('sha256').update(title).digest('hex').slice(0,7),16)+1;
 const time=(d:Date)=>d.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
 const rows=snapshot.items.map(i=>[time(savedAt),time(new Date(snapshot.dispatchedAt)),snapshot.orderNumber,snapshot.tracking,i.code,i.name??'',i.quantityMilliG/1000,i.unitCostSatang/100,i.costSatang/100,snapshot.orderId]);
 const key='stock-shipment-'+createHash('sha256').update(snapshot.orderId).digest('hex').slice(0,32),fingerprint=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 return {title,sheetId,rows,key,fingerprint};
}
// This archive must be confirmed before the live stock operation is permitted.
export async function saveShipmentArchive(client:StockClient,snapshot:StockOutSnapshot,savedAt:Date){
 const a=shipmentArchive(snapshot,savedAt),metadata=await client('?fields=sheets(properties(sheetId,title))');
 let sheet=metadata.sheets?.find((s:any)=>s.properties.title===a.title)?.properties;
 if(!sheet){
  if(metadata.sheets?.some((s:any)=>s.properties.sheetId===a.sheetId))throw Error('STOCK_HISTORY_CONFLICT');
  const headers=['บันทึกก่อนตัดสต๊อก','จัดส่งจริง','ออเดอร์','เลขพัสดุ','รหัสสินค้า','ชื่อสินค้า','จำนวน (G)','ต้นทุน (บาท/G)','ต้นทุนรวม (บาท)','รายการอ้างอิง'];
  await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
   {addSheet:{properties:{sheetId:a.sheetId,title:a.title,gridProperties:{rowCount:1000,columnCount:10,frozenRowCount:1}}}},
   {updateCells:{start:{sheetId:a.sheetId,rowIndex:0,columnIndex:0},rows:[{values:headers.map(stringValue=>({userEnteredValue:{stringValue}}))}],fields:'userEnteredValue'}},
   {repeatCell:{range:{sheetId:a.sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:0.85,green:0.92,blue:1},textFormat:{bold:true},wrapStrategy:'WRAP'}},fields:'userEnteredFormat'}},
   {updateDimensionProperties:{range:{sheetId:a.sheetId,dimension:'COLUMNS',startIndex:0,endIndex:10},properties:{pixelSize:160},fields:'pixelSize'}},
   {updateDimensionProperties:{range:{sheetId:a.sheetId,dimension:'COLUMNS',startIndex:9,endIndex:10},properties:{hiddenByUser:true},fields:'hiddenByUser'}},
   {addProtectedRange:{protectedRange:{range:{sheetId:a.sheetId},warningOnly:true,description:'ประวัติการจัดส่งก่อนตัดสต๊อก'}}}
  ]})});sheet={sheetId:a.sheetId};
 }
 const found=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:a.key,visibility:'DOCUMENT'}}]})});
 const marker=found.matchedDeveloperMetadata?.[0]?.developerMetadata;
 if(marker&&marker.metadataValue!==a.fingerprint)throw Error('STOCK_HISTORY_CONFLICT');
 if(!marker)await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
  {appendCells:{sheetId:sheet.sheetId,rows:a.rows.map(row=>({values:row.map(v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:v}}))})),fields:'userEnteredValue'}},
  {createDeveloperMetadata:{developerMetadata:{metadataKey:a.key,metadataValue:a.fingerprint,location:{sheetId:sheet.sheetId},visibility:'DOCUMENT'}}}
 ]})});
 const read=await client('/values/'+encodeURIComponent("'"+a.title+"'!A:J")+'?valueRenderOption=UNFORMATTED_VALUE');
 const actual=(read.values??[]).filter((r:unknown[])=>r[9]===snapshot.orderId).map((r:unknown[])=>Array.from({length:10},(_,i)=>r[i]??''));
 if(JSON.stringify(actual)!==JSON.stringify(a.rows))throw Error('STOCK_HISTORY_NOT_CONFIRMED');
 return sheet.sheetId as number;
}
