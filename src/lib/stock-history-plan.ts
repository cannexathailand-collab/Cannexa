import {createHash,randomInt} from 'node:crypto';
import {bangkokDay,dayStart,shiftDay} from './sales-dates';
import {stockColumnStyles} from './stock-column-style';
import type {StockRow} from './stock-import';

export const stockHistoryTitle=(day:string)=>'ปิดยอด '+day;
export function stockClosingDay(startDay:string,now=new Date()){
 const day=shiftDay(bangkokDay(now),-1);
 return day>=startDay?day:null;
}
export function stockHistoryDate(raw:string|undefined,fallback:string){
 try{if(raw){dayStart(raw);return raw;}}catch{}
 return fallback;
}
type Source={tab:{sheetId:number;title:string};rows:unknown[][];products:StockRow[];readAt:Date};
export function stockHistorySnapshot(day:string,source:Source,actor:string,sheetId=randomInt(1,2_000_000_000)){
 dayStart(day);
 if(day>=bangkokDay(source.readAt))throw Error('STOCK_DAY_NOT_FINISHED');
 const products=source.products.map(p=>({...p,salePrices:p.salePrices.map(price=>({...price}))})).sort((a,b)=>a.code.localeCompare(b.code,'en'));
 const rows:(string|number)[][]=[
  ['ยอดปิด '+day,'ชื่อสินค้า','รายการ','ต้นทุน (บาท/G)','จำนวนรับ (G)',source.products.some(p=>p.completedQuantity!==undefined)?'จำนวนรอจ่าย (G)':'จำนวนจ่าย (G)','คงเหลือ (G)','','ราคาขาย (บาท)','','',''],
  [source.readAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}),'','','','','','','',...Array.from({length:4},(_,i)=>String(source.rows[1]?.[i+8]??''))],
  ...products.map(p=>['',p.name??'',p.code,p.costSatang===null?'':p.costSatang/100,p.receivedQuantity??'',p.issuedQuantity??'',p.remainingQuantity??'','',...Array.from({length:4},(_,i)=>{const v=source.rows[p.sourceRow-1]?.[i+8];return typeof v==='number'||typeof v==='string'?v:'';})])
 ];
 const fingerprint=createHash('sha256').update(JSON.stringify({day,sourceSheet:source.tab.title,rows,products})).digest('hex');
 return {day,actor,sourceSheet:source.tab.title,capturedAt:source.readAt,products,rows,fingerprint,sheetId,sheetTitle:stockHistoryTitle(day)};
}
export function stockHistoryRequests(snapshot:{sheetId:number;sheetTitle:string;fingerprint:string;rows:unknown[][]}){
 const {sheetId,rows}=snapshot,endRowIndex=rows.length;
 return [
  {addSheet:{properties:{sheetId,title:snapshot.sheetTitle,gridProperties:{rowCount:Math.max(endRowIndex,3),columnCount:12,frozenRowCount:2,frozenColumnCount:3}}}},
  {updateCells:{start:{sheetId,rowIndex:0,columnIndex:0},rows:rows.map(row=>({values:row.map(v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v??'')}}))})),fields:'userEnteredValue'}},
  ...stockColumnStyles(sheetId,endRowIndex),
  {repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:2},cell:{userEnteredFormat:{textFormat:{bold:true},wrapStrategy:'WRAP',verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat.textFormat.bold,userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment'}},
  ...(endRowIndex>2?[{repeatCell:{range:{sheetId,startRowIndex:2,endRowIndex,startColumnIndex:3,endColumnIndex:12},cell:{userEnteredFormat:{numberFormat:{type:'NUMBER',pattern:'#,##0.###'}}},fields:'userEnteredFormat.numberFormat'}}]:[]),
  {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:0,endIndex:1},properties:{pixelSize:195},fields:'pixelSize'}},
  {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:1,endIndex:2},properties:{pixelSize:250},fields:'pixelSize'}},
  {updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:2,endIndex:12},properties:{pixelSize:125},fields:'pixelSize'}},
  {updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:0,endIndex:2},properties:{pixelSize:44},fields:'pixelSize'}},
  {setBasicFilter:{filter:{range:{sheetId,startRowIndex:1,endRowIndex,startColumnIndex:0,endColumnIndex:12}}}},
  {addProtectedRange:{protectedRange:{range:{sheetId},warningOnly:true,description:'ประวัติยอดปิดรายวัน การแก้ไขแท็บนี้ไม่เปลี่ยนประวัติที่บันทึกในระบบ'}}},
  {createDeveloperMetadata:{developerMetadata:{metadataKey:'cannexa-stock-close',metadataValue:snapshot.fingerprint,location:{sheetId},visibility:'DOCUMENT'}}}
 ];
}
export function stockHistoryValuesMatch(expected:unknown[][],actual:unknown[][]){
 const normalize=(rows:unknown[][])=>rows.map(row=>Array.from({length:12},(_,i)=>row[i]??''));
 return JSON.stringify(normalize(expected))===JSON.stringify(normalize(actual));
}
