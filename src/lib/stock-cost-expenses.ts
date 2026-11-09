import {bangkokDay,dayStart} from './sales-dates';
import {orderProductCost} from './order-product-cost';
import type {StockCostItem} from './stock-dispatch-plan';
import type {ExpenseEntry} from './expense-report';
export function stockCostExpenses(dispatches:{id:string;orderNumber:string;orderId?:string;tracking:string|null;status:string;dispatchedAt:Date|null;items:unknown}[],roundDates:Map<string,Date>=new Map()):ExpenseEntry[]{
 return dispatches.filter(d=>d.status==='POSTED'&&d.dispatchedAt&&d.tracking).flatMap(d=>(Array.isArray(d.items)?d.items:[]).map((item:StockCostItem)=>({id:'stock-cost:'+d.id+':'+item.code,kind:'PRODUCT_COST' as const,date:roundDates.get(d.orderId??'')??d.dispatchedAt!,description:'ต้นทุนสินค้า · '+item.code+(item.name?' '+item.name:'')+' · '+(item.quantityMilliG/1000)+' G · '+d.orderNumber,amountSatang:item.costSatang,recipient:null,bankName:null,bankAccount:null,tracking:d.tracking!})));
}
export function stockReturnExpenses(returns:{id:string;tracking:string;status:string;receivedAt:Date|null;items:unknown;historySnapshot?:unknown}[]):ExpenseEntry[]{
 return returns.filter(r=>r.status==='POSTED'&&r.receivedAt).flatMap(r=>(Array.isArray(r.items)?r.items:[]).map((item:StockCostItem)=>({id:'stock-return:'+r.id+':'+item.code,kind:'PRODUCT_COST' as const,date:r.receivedAt!,description:'คืนต้นทุนสินค้าตีกลับ · '+item.code+(item.name?' '+item.name:'')+' · '+(item.quantityMilliG/1000)+' G · '+String((r.historySnapshot as {orderNumber?:string}|null)?.orderNumber??r.tracking),amountSatang:-item.costSatang,recipient:null,bankName:null,bankAccount:null,tracking:r.tracking})));
}

export function estimatedOrderCosts(orders:{id:string;orderNumber:string;rawText:string|null;status:string}[],postedOrderIds:Set<string>,unitCosts:Map<string,number|null>,roundDates:Map<string,Date>){
 const entries:ExpenseEntry[]=[],missingOrderIds:string[]=[];
 for(const order of orders){
  if(postedOrderIds.has(order.id)||['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(order.status))continue;
  const date=roundDates.get(order.id);if(!date)continue;
  const cost=orderProductCost(order.rawText,null,unitCosts);
  if(cost.amountSatang===null){missingOrderIds.push(order.id);continue;}
  entries.push({id:'order-cost:'+order.id,kind:'PRODUCT_COST',date,description:'ต้นทุนสินค้า (ประมาณการก่อนจัดส่ง) · '+order.orderNumber,amountSatang:cost.amountSatang,recipient:null,bankName:null,bankAccount:null,estimated:true});
 }
 return {entries,missingOrderIds};
}

export type GroupedExpenseEntry=ExpenseEntry&{details?:ExpenseEntry[]};
export function groupProductCostExpenses(entries:ExpenseEntry[]):GroupedExpenseEntry[]{
 const groups=Map.groupBy(entries.filter(entry=>entry.kind==='PRODUCT_COST'),entry=>bangkokDay(entry.date));
 const costs=[...groups].map(([day,details]):GroupedExpenseEntry=>({id:'product-cost-day:'+day,kind:'PRODUCT_COST',date:dayStart(day),description:'ต้นทุนสินค้ารวมประจำวัน',amountSatang:details.reduce((sum,entry)=>sum+entry.amountSatang,0),recipient:null,bankName:null,bankAccount:null,estimated:details.some(entry=>entry.estimated),details}));
 return [...entries.filter(entry=>entry.kind!=='PRODUCT_COST'),...costs].sort((a,b)=>+b.date-+a.date||a.id.localeCompare(b.id));
}
