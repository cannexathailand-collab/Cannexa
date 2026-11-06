import {createHash} from 'node:crypto';import type {NewStockProduct} from './stock-product-input';import {stockSheetRow} from './stock-product-input';import type {StockRow} from './stock-import';
import {stockColumnStyles} from './stock-column-style';
export type StockReceiptResult={code:string;mode:'CREATED'|'RECEIVED';quantity:number;receivedBefore:number;receivedAfter:number;remainingBefore:number;remainingAfter:number;sourceSheet:string;fingerprint:string;nameBefore:string|null;nameAfter:string|null};
export const receiptKey=(requestKey:string)=>'cannexa-stock-receipt-'+requestKey;
export const receiptFingerprint=(input:NewStockProduct)=>createHash('sha256').update(JSON.stringify(input)).digest('hex');
export function stockReceiptPlan(input:NewStockProduct,source:{tab:{sheetId:number;title:string;gridProperties?:{columnCount?:number}};rows:unknown[][];products:StockRow[]},remainingFormula?:string){
 const existing=source.products.find(p=>p.code===input.code);const requests:Record<string,unknown>[]=[];const add=(a:number,b:number)=>Math.round((a+b)*1000)/1000;
 if(existing&&(existing.receivedQuantity===null||existing.remainingQuantity===null))throw new Error('STOCK_QUANTITY_UNKNOWN');
 const receivedBefore=existing?.receivedQuantity??0,remainingBefore=existing?.remainingQuantity??0,receivedAfter=add(receivedBefore,input.quantity),remainingAfter=add(remainingBefore,input.quantity);
 if(Math.max(Math.abs(receivedAfter),Math.abs(remainingAfter))>=1e15)throw new Error('STOCK_QUANTITY_TOO_LARGE');
 const result:StockReceiptResult={code:input.code,mode:existing?'RECEIVED':'CREATED',quantity:input.quantity,receivedBefore,receivedAfter,remainingBefore,remainingAfter,sourceSheet:source.tab.title,fingerprint:receiptFingerprint(input),nameBefore:existing?.name??null,nameAfter:existing?.name||input.name||null};
 const numberCell=(columnIndex:number,n:number)=>({updateCells:{start:{sheetId:source.tab.sheetId,rowIndex:existing!.sourceRow-1,columnIndex},rows:[{values:[{userEnteredValue:{numberValue:n}}]}],fields:'userEnteredValue'}});
 if(existing){if(!existing.name&&input.name)requests.push({updateCells:{start:{sheetId:source.tab.sheetId,rowIndex:existing.sourceRow-1,columnIndex:1},rows:[{values:[{userEnteredValue:{stringValue:input.name}}]}],fields:'userEnteredValue'}});requests.push(numberCell(4,receivedAfter));if(!remainingFormula?.startsWith('='))requests.push(numberCell(6,remainingAfter));}
 else{requests.push({appendCells:{sheetId:source.tab.sheetId,rows:[{values:stockSheetRow(input,source.rows[1]?.slice(8,12)).map(value=>({userEnteredValue:typeof value==='number'?{numberValue:value}:{stringValue:value}}))}],fields:'userEnteredValue'}});}
 requests.push({sortRange:{range:{sheetId:source.tab.sheetId,startRowIndex:2,endRowIndex:Math.max(source.rows.length,3)+(existing?0:1),startColumnIndex:0,endColumnIndex:source.tab.gridProperties?.columnCount??26},sortSpecs:[{dimensionIndex:2,sortOrder:'ASCENDING'}]}});
 requests.push(...stockColumnStyles(source.tab.sheetId,Math.max(source.rows.length,3)+(existing?0:1)));
 requests.push({createDeveloperMetadata:{developerMetadata:{metadataKey:receiptKey(input.requestKey),metadataValue:JSON.stringify(result),location:{spreadsheet:true},visibility:'DOCUMENT'}}});
 return {requests,result};
}
export function recoverReceipt(input:NewStockProduct,metadata:unknown):StockReceiptResult|null{const matches=(metadata as {matchedDeveloperMetadata?:{developerMetadata?:{metadataValue?:string}}[]})?.matchedDeveloperMetadata??[];if(!matches.length)return null;const raw=matches[0].developerMetadata?.metadataValue;if(!raw)throw new Error('STOCK_RECEIPT_INVALID');const result=JSON.parse(raw) as StockReceiptResult;if(result.fingerprint!==receiptFingerprint(input)||result.code!==input.code)throw new Error('STOCK_REQUEST_CHANGED');return result;}
