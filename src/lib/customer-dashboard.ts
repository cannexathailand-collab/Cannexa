import {buildCrmDashboard} from './crm-dashboard';
import type {summarizeCustomerOrders} from './customer-crm';
import {orderStockItems} from './order-stock-items';
import {bangkokDay,dayStart,shiftDay,DAY_MS} from './sales-dates';

type History=ReturnType<typeof summarizeCustomerOrders>['allHistory'];
function periodMetrics(history:History,from:string,to:string){
 const selected=history.filter(row=>{const day=bangkokDay(row.order.eventAt);return day>=from&&day<=to;});
 const completed=selected.filter(row=>row.recognized),revenueSatang=completed.reduce((sum,row)=>sum+(row.amountSatang??0),0);
 const missingCosts=completed.filter(row=>row.profitSatang===null).length;
 const profitSatang=missingCosts?null:completed.reduce((sum,row)=>sum+(row.profitSatang??0),0);
 return {purchases:completed.length,revenueSatang,profitSatang,missingCosts,averageOrderSatang:completed.length?Math.round(revenueSatang/completed.length):null,profitMargin:profitSatang!==null&&revenueSatang>0?profitSatang/revenueSatang*100:null};
}
export function buildCustomerDashboard(history:History,range?:{from:string;to:string},now=new Date()){
 const rows=[...new Map(history.map(row=>[row.order.id,row])).values()];
 const currentRange=range??{from:shiftDay(bangkokDay(now),-29),to:bangkokDay(now)};
 const days=Math.round((+dayStart(currentRange.to)-+dayStart(currentRange.from))/DAY_MS)+1;
 const previousRange={from:shiftDay(currentRange.from,-days),to:shiftDay(currentRange.from,-1)};
 const statusCounts={completed:0,pending:0,returned:0,cancelled:0,claim:0};
 const payments=[{key:'โอน',label:'โอนเงิน',count:0,amountSatang:0,unknownAmounts:0},{key:'COD',label:'COD',count:0,amountSatang:0,unknownAmounts:0}];
 const products=new Map<string,{code:string;orders:number;quantityMilliG:number}>();let unreadableProductOrders=0;
 for(const row of rows){
  const closed=!!row.order.withdrawnAt||['CANCELLED','WITHDRAWN','EXPIRED'].includes(row.order.status);
  const status=row.returned?'returned':closed?'cancelled':row.order.payment==='เคลม'?'claim':row.recognized?'completed':'pending';
  statusCounts[status]++;
  if(!row.excluded){const payment=payments.find(item=>item.key===row.order.payment);if(payment){payment.count++;payment.amountSatang+=row.amountSatang??0;if(row.amountSatang===null)payment.unknownAmounts++;}}
  if(row.recognized){const parsed=orderStockItems(row.order.rawText);if(parsed.issues.length)unreadableProductOrders++;for(const item of parsed.items){const previous=products.get(item.code)??{code:item.code,orders:0,quantityMilliG:0};previous.orders++;previous.quantityMilliG+=item.quantityMilliG;products.set(item.code,previous);}}
 }
 const statuses=[{key:'completed',label:'ซื้อสำเร็จ',color:'#8dc8a3'},{key:'pending',label:'รอดำเนินการ / ตรวจสอบ',color:'#a6cbe0'},{key:'returned',label:'ตีกลับ',color:'#efb1ae'},{key:'cancelled',label:'ยกเลิก / ถอนรายการ',color:'#bfc8c3'},{key:'claim',label:'เคลม',color:'#d6b9df'}].map(item=>({...item,count:statusCounts[item.key as keyof typeof statusCounts]}));
 return {currentRange,previousRange,current:periodMetrics(rows,currentRange.from,currentRange.to),previous:periodMetrics(rows,previousRange.from,previousRange.to),trend:buildCrmDashboard([{code:'customer',name:null,tier:'',history:rows}],now),statuses,totalOrders:rows.length,payments,products:[...products.values()].sort((a,b)=>b.orders-a.orders||b.quantityMilliG-a.quantityMilliG||a.code.localeCompare(b.code)).slice(0,5),unreadableProductOrders};
}
export type CustomerDashboardData=ReturnType<typeof buildCustomerDashboard>;
