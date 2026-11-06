import {stockCode} from './stock-code';
import {STOCK_COMPLETED_HEADER,milli,stockNumberCell,stockBalanceFormula,type FlowPlan,type FlowSource} from './stock-flow-plan';
import type {StockCostItem} from './stock-dispatch-plan';

export type StockReturnSnapshot={returnId:string;dispatchId:string;orderId:string;orderNumber:string;tracking:string;sourceSheet:string;receivedAt:string;reportedAt:string;processedAt:string;dateBasis:'RECEIVED_AT'|'EMAIL_REPORT_RECEIVED_AT';evidence:unknown[];items:StockCostItem[];totalCostSatang:number};

export function stockReturnItems(raw:unknown,totalCostSatang:number|null):StockCostItem[]{
 if(!Array.isArray(raw)||!raw.length||!Number.isSafeInteger(totalCostSatang)||totalCostSatang===null||totalCostSatang<0)throw Error('STOCK_RETURN_ITEMS_INVALID');
 const seen=new Set<string>();let sum=0;
 const items=raw.map(value=>{
  if(!value||typeof value!=='object')throw Error('STOCK_RETURN_ITEMS_INVALID');
  const item=value as StockCostItem,code=stockCode.safeParse(item.code);
  if(!code.success||seen.has(code.data)||!Number.isSafeInteger(item.quantityMilliG)||item.quantityMilliG<=0||!Number.isSafeInteger(item.unitCostSatang)||item.unitCostSatang<0||!Number.isSafeInteger(item.costSatang)||item.costSatang<0)throw Error('STOCK_RETURN_ITEMS_INVALID');
  seen.add(code.data);sum+=item.costSatang;
  return {...item,code:code.data};
 });
 if(!Number.isSafeInteger(sum)||sum!==totalCostSatang||sum>2147483647)throw Error('STOCK_RETURN_COST_MISMATCH');
 return items;
}

export function stockReturnPlan(items:Pick<StockCostItem,'code'|'quantityMilliG'>[],source:FlowSource):FlowPlan{
 if(source.rows[0]?.[12]!==STOCK_COMPLETED_HEADER)throw Error('STOCK_FLOW_NOT_READY');
 if(!items.length)throw Error('STOCK_RETURN_ITEMS_INVALID');
 const changes:FlowPlan['changes']=[],requests:FlowPlan['requests']=[],seen=new Set<string>();
 for(const item of items){
  const code=stockCode.safeParse(item.code);
  if(!code.success||seen.has(code.data)||!Number.isSafeInteger(item.quantityMilliG)||item.quantityMilliG<=0)throw Error('STOCK_RETURN_ITEMS_INVALID');
  seen.add(code.data);
  const product=source.products.find(p=>p.code===code.data);if(!product)throw Error('STOCK_PRODUCT_NOT_FOUND '+code.data);
  if(product.receivedQuantity===null||product.remainingQuantity===null||product.issuedQuantity===null||product.completedQuantity==null)throw Error('STOCK_QUANTITY_UNKNOWN '+code.data);
  if(milli(product.receivedQuantity)-milli(product.completedQuantity)!==milli(product.remainingQuantity))throw Error('STOCK_BALANCE_MISMATCH');
  const receivedAfter=(milli(product.receivedQuantity)+item.quantityMilliG)/1000,remainingAfter=(milli(product.remainingQuantity)+item.quantityMilliG)/1000;
  milli(receivedAfter);milli(remainingAfter);
  const credit=product.precountedPendingQuantity??0,unknown=product.unverifiedPendingQuantity??0;
  changes.push({code:code.data,received:receivedAfter,receivedBefore:product.receivedQuantity,pendingBefore:product.issuedQuantity,pendingAfter:product.issuedQuantity,remainingBefore:product.remainingQuantity,remainingAfter,completedBefore:product.completedQuantity,completedAfter:product.completedQuantity,precountedBefore:credit,precountedAfter:credit,unverifiedBefore:unknown,unverifiedAfter:unknown});
  requests.push(stockNumberCell(source.tab.sheetId,product.sourceRow,4,receivedAfter),stockBalanceFormula(source.tab.sheetId,product.sourceRow));
 }
 return {sourceSheet:source.tab.title,changes,requests};
}

export function returnedItemsAtPlan(items:StockCostItem[],plan:FlowPlan):StockCostItem[]{
 return items.map(item=>{
  const change=plan.changes.find(c=>c.code===item.code);if(!change)throw Error('STOCK_RETURN_ITEMS_INVALID');
  return {...item,issuedBefore:change.pendingBefore!,issuedAfter:change.pendingAfter,receivedBefore:change.receivedBefore!,receivedAfter:change.received!,remainingBefore:change.remainingBefore!,remainingAfter:change.remainingAfter!,completedBefore:change.completedBefore,completedAfter:change.completedAfter};
 });
}
