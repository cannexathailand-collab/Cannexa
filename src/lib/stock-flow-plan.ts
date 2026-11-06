import type {StockRow} from './stock-import';
import type {OrderStockItem} from './order-stock-items';
import {STOCK_AVAILABLE_HEADER,STOCK_PENDING_HEADER,stockAvailableFormula} from './stock-available';
export const STOCK_COMPLETED_HEADER='ตัดสต๊อกสะสม (G)';
export type FlowSource={tab:{sheetId:number;title:string};rows:unknown[][];products:StockRow[]};
export type FlowChange={code:string;received:number|null;pendingBefore:number|null;pendingAfter:number;remainingBefore:number|null;remainingAfter:number|null;completedBefore:number;completedAfter:number};
export type FlowPlan={sourceSheet:string;changes:FlowChange[];requests:any[]};
export const milli=(n:number)=>{const v=Math.round(n*1000);if(!Number.isSafeInteger(v)||Math.abs(v-n*1000)>0.0001)throw Error('INVALID_STOCK_QUANTITY');return v;};
const add=(a:number,b:number)=>(milli(a)+milli(b))/1000;
export const stockNumberCell=(sheetId:number,row:number,columnIndex:number,n:number)=>({updateCells:{start:{sheetId,rowIndex:row-1,columnIndex},rows:[{values:[{userEnteredValue:{numberValue:n}}]}],fields:'userEnteredValue'}});
export const stockBalanceFormula=(sheetId:number,row:number)=>({updateCells:{start:{sheetId,rowIndex:row-1,columnIndex:6},rows:[{values:[{userEnteredValue:{formulaValue:'=INDEX(E:E,ROW())-INDEX(M:M,ROW())'}}]}],fields:'userEnteredValue'}});
export function flowBaselinePlan(source:FlowSource):FlowPlan{
 if(source.rows[0]?.[12]&&source.rows[0][12]!==STOCK_COMPLETED_HEADER)throw Error('STOCK_HELPER_COLUMN_IN_USE');
 if(source.rows.slice(2).some(r=>r[12]!==undefined&&r[12]!==''&&r[12]!==null))throw Error('STOCK_HELPER_COLUMN_IN_USE');
 if(source.rows.some(r=>r[13]!==undefined&&r[13]!==''&&r[13]!==null))throw Error('STOCK_AVAILABLE_COLUMN_IN_USE');
 const changes:FlowChange[]=[],requests:any[]=[];
 for(const p of source.products){
  const completed=p.issuedQuantity??0;
  if(p.receivedQuantity===null||p.remainingQuantity===null||milli(p.receivedQuantity)-milli(completed)!==milli(p.remainingQuantity)||completed<0)throw Error('STOCK_BASELINE_INCONSISTENT '+p.code);
  changes.push({code:p.code,received:p.receivedQuantity,pendingBefore:p.issuedQuantity,pendingAfter:0,remainingBefore:p.remainingQuantity,remainingAfter:p.remainingQuantity,completedBefore:completed,completedAfter:completed});
  requests.push(stockNumberCell(source.tab.sheetId,p.sourceRow,5,0),stockNumberCell(source.tab.sheetId,p.sourceRow,12,completed),stockBalanceFormula(source.tab.sheetId,p.sourceRow));
  requests.push({updateCells:{start:{sheetId:source.tab.sheetId,rowIndex:p.sourceRow-1,columnIndex:13},rows:[{values:[{userEnteredValue:{formulaValue:stockAvailableFormula}}]}],fields:'userEnteredValue'}});
 }
 requests.push({updateCells:{start:{sheetId:source.tab.sheetId,rowIndex:0,columnIndex:12},rows:[{values:[{userEnteredValue:{stringValue:STOCK_COMPLETED_HEADER}}]}],fields:'userEnteredValue'}},{updateDimensionProperties:{range:{sheetId:source.tab.sheetId,dimension:'COLUMNS',startIndex:12,endIndex:13},properties:{hiddenByUser:true},fields:'hiddenByUser'}});
 for(const [columnIndex,label]of [[5,STOCK_PENDING_HEADER],[13,STOCK_AVAILABLE_HEADER]] as const)requests.push({updateCells:{start:{sheetId:source.tab.sheetId,rowIndex:0,columnIndex},rows:[{values:[{userEnteredValue:{stringValue:label}}]}],fields:'userEnteredValue'}});
 requests.push({repeatCell:{range:{sheetId:source.tab.sheetId,startColumnIndex:13,endColumnIndex:14},cell:{userEnteredFormat:{backgroundColor:{red:0.88,green:0.96,blue:0.9},horizontalAlignment:'CENTER',verticalAlignment:'MIDDLE',wrapStrategy:'WRAP',numberFormat:{type:'NUMBER',pattern:'#,##0.###'}}},fields:'userEnteredFormat'}},{updateDimensionProperties:{range:{sheetId:source.tab.sheetId,dimension:'COLUMNS',startIndex:13,endIndex:14},properties:{pixelSize:190},fields:'pixelSize'}});
 return {sourceSheet:source.tab.title,changes,requests};
}
export function flowReservationPlan(items:OrderStockItem[],source:FlowSource,release=false):FlowPlan{
 if(source.rows[0]?.[12]!==STOCK_COMPLETED_HEADER)throw Error('STOCK_FLOW_NOT_READY');
 const changes:FlowChange[]=[],requests:any[]=[];
 for(const item of items){
  const p=source.products.find(p=>p.code===item.code);if(!p)throw Error('STOCK_PRODUCT_NOT_FOUND '+item.code);
  if(p.receivedQuantity===null||p.remainingQuantity===null||p.issuedQuantity===null||p.completedQuantity===undefined||p.completedQuantity===null)throw Error('STOCK_QUANTITY_UNKNOWN '+item.code);
  if(milli(p.receivedQuantity)-milli(p.completedQuantity)!==milli(p.remainingQuantity))throw Error('STOCK_BALANCE_MISMATCH');
  const quantity=item.quantityMilliG/1000,pending=p.issuedQuantity;
  if(release&&milli(pending)<item.quantityMilliG)throw Error('STOCK_PENDING_MISMATCH '+item.code);
  const after=add(pending,release?-quantity:quantity);
  changes.push({code:p.code,received:p.receivedQuantity,pendingBefore:pending,pendingAfter:after,remainingBefore:p.remainingQuantity,remainingAfter:p.remainingQuantity,completedBefore:p.completedQuantity,completedAfter:p.completedQuantity});
  requests.push(stockNumberCell(source.tab.sheetId,p.sourceRow,5,after));
 }
 return {sourceSheet:source.tab.title,changes,requests};
}
export function flowDispatchPlan(items:OrderStockItem[],source:FlowSource):FlowPlan{
 if(source.rows[0]?.[12]!==STOCK_COMPLETED_HEADER)throw Error('STOCK_FLOW_NOT_READY');
 const changes:FlowChange[]=[],requests:any[]=[];
 for(const item of items){
  const p=source.products.find(p=>p.code===item.code);
  if(!p||p.receivedQuantity===null||p.remainingQuantity===null||p.issuedQuantity===null||p.completedQuantity==null)throw Error('STOCK_QUANTITY_UNKNOWN');
  if(milli(p.receivedQuantity)-milli(p.completedQuantity)!==milli(p.remainingQuantity))throw Error('STOCK_BALANCE_MISMATCH');
  if(milli(p.issuedQuantity)<item.quantityMilliG||milli(p.remainingQuantity)<item.quantityMilliG)throw Error('STOCK_PENDING_MISMATCH');
  const quantity=item.quantityMilliG/1000,pendingAfter=add(p.issuedQuantity,-quantity),remainingAfter=add(p.remainingQuantity,-quantity),completedAfter=add(p.completedQuantity,quantity);
  changes.push({code:p.code,received:p.receivedQuantity,pendingBefore:p.issuedQuantity,pendingAfter,remainingBefore:p.remainingQuantity,remainingAfter,completedBefore:p.completedQuantity,completedAfter});
  requests.push(stockNumberCell(source.tab.sheetId,p.sourceRow,5,pendingAfter),stockNumberCell(source.tab.sheetId,p.sourceRow,12,completedAfter),stockBalanceFormula(source.tab.sheetId,p.sourceRow));
 }
 return {sourceSheet:source.tab.title,changes,requests};
}
export function verifyFlowPlan(plan:FlowPlan,source:FlowSource){
 const equal=(a:number|null|undefined,b:number|null)=>a===b||(typeof a==='number'&&typeof b==='number'&&milli(a)===milli(b));
 return plan.sourceSheet===source.tab.title&&plan.changes.every(c=>{const p=source.products.find(p=>p.code===c.code);return p&&equal(p.receivedQuantity,c.received)&&equal(p.issuedQuantity,c.pendingAfter)&&equal(p.remainingQuantity,c.remainingAfter)&&equal(p.completedQuantity,c.completedAfter)&&equal(source.rows[p.sourceRow-1]?.[13] as number,c.remainingAfter===null?null:(milli(c.remainingAfter)-milli(c.pendingAfter))/1000);});
}
