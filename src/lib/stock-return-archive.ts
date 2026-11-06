import {createHash} from 'node:crypto';
import {bangkokDay} from './sales-dates';
import type {StockClient} from './stock-flow-operation';
import type {StockReturnSnapshot} from './stock-return-plan';

const headers=['เก็บประวัติก่อนคืนสต๊อก','รับคืน / วันที่รายงาน','ออเดอร์','เลขพัสดุเดิม','รหัสสินค้า','ชื่อสินค้าขณะจัดส่ง','รับคืน (G)','ต้นทุนเดิม (บาท/G)','คืนต้นทุนสินค้า (บาท)','รายการรับคืน','ยอดตั้งต้นขณะเก็บประวัติ (G)','ยอดยกมาที่คำนวณ (G)','คงเหลือขณะเก็บประวัติ (G)','คงเหลือหลังรับคืนที่คำนวณ (G)','รายการตัดสต๊อกเดิม'];
export function stockReturnArchive(snapshot:StockReturnSnapshot,savedAt:Date){
 const title='รับคืน '+bangkokDay(savedAt),sheetId=parseInt(createHash('sha256').update(title).digest('hex').slice(0,7),16)+1;
 const time=(date:Date)=>date.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
 const rows=snapshot.items.map(item=>[time(savedAt),time(new Date(snapshot.receivedAt)),snapshot.orderNumber,snapshot.tracking,item.code,item.name??'',item.quantityMilliG/1000,item.unitCostSatang/100,-item.costSatang/100,snapshot.returnId,item.receivedBefore??'',item.receivedAfter??'',item.remainingBefore,item.remainingAfter,snapshot.dispatchId]);
 const key='stock-return-archive-'+createHash('sha256').update(snapshot.tracking).digest('hex').slice(0,32),fingerprint=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 return {title,sheetId,rows,key,fingerprint};
}

export async function saveStockReturnArchive(client:StockClient,snapshot:StockReturnSnapshot,savedAt:Date){
 const archive=stockReturnArchive(snapshot,savedAt),meta=await client('?fields=sheets(properties(sheetId,title),developerMetadata)');
 let sheet=meta.sheets?.find((s:any)=>s.properties.title===archive.title);
 if(sheet&&(sheet.properties.sheetId!==archive.sheetId||!sheet.developerMetadata?.some((m:any)=>m.metadataKey==='cannexa-stock-return-archive'&&m.metadataValue==='v1')))throw Error('STOCK_HISTORY_CONFLICT');
 if(!sheet){
  if(meta.sheets?.some((s:any)=>s.properties.sheetId===archive.sheetId))throw Error('STOCK_HISTORY_CONFLICT');
  await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
   {addSheet:{properties:{sheetId:archive.sheetId,title:archive.title,gridProperties:{rowCount:1000,columnCount:15,frozenRowCount:1}}}},
   {updateCells:{start:{sheetId:archive.sheetId,rowIndex:0,columnIndex:0},rows:[{values:headers.map(stringValue=>({userEnteredValue:{stringValue}}))}],fields:'userEnteredValue'}},
   {repeatCell:{range:{sheetId:archive.sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:0.86,green:0.96,blue:0.89},textFormat:{bold:true},wrapStrategy:'WRAP'}},fields:'userEnteredFormat'}},
   {updateDimensionProperties:{range:{sheetId:archive.sheetId,dimension:'COLUMNS',startIndex:0,endIndex:15},properties:{pixelSize:165},fields:'pixelSize'}},
   {updateDimensionProperties:{range:{sheetId:archive.sheetId,dimension:'COLUMNS',startIndex:9,endIndex:10},properties:{hiddenByUser:true},fields:'hiddenByUser'}},
   {addProtectedRange:{protectedRange:{range:{sheetId:archive.sheetId},warningOnly:true,description:'ประวัติก่อนคืนสต๊อก ยอดหลังรับคืนเป็นยอดคำนวณ ณ เวลาบันทึก'}}},
   {createDeveloperMetadata:{developerMetadata:{metadataKey:'cannexa-stock-return-archive',metadataValue:'v1',location:{sheetId:archive.sheetId},visibility:'DOCUMENT'}}}
  ]})});sheet={properties:{sheetId:archive.sheetId}};
 }
 const found=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:archive.key,visibility:'DOCUMENT'}}]})});
 const marker=found.matchedDeveloperMetadata?.[0]?.developerMetadata;
 if(marker&&marker.metadataValue!==archive.fingerprint)throw Error('STOCK_HISTORY_CONFLICT');
 if(!marker)await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[
  {appendCells:{sheetId:archive.sheetId,rows:archive.rows.map(row=>({values:row.map(value=>({userEnteredValue:typeof value==='number'?{numberValue:value}:{stringValue:value}}))})),fields:'userEnteredValue'}},
  {createDeveloperMetadata:{developerMetadata:{metadataKey:archive.key,metadataValue:archive.fingerprint,location:{sheetId:archive.sheetId},visibility:'DOCUMENT'}}}
 ]})});
 const result=await client('/values/'+encodeURIComponent("'"+archive.title+"'!A:O")+'?valueRenderOption=UNFORMATTED_VALUE');
 const rows=(result.values??[]).filter((row:unknown[])=>row[9]===snapshot.returnId).map((row:unknown[])=>Array.from({length:15},(_,index)=>row[index]??''));
 if(JSON.stringify(rows)!==JSON.stringify(archive.rows))throw Error('STOCK_HISTORY_NOT_CONFIRMED');
 return sheet.properties.sheetId as number;
}
