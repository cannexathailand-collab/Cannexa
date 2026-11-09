import type {StockCostItem} from './stock-dispatch-plan';
import type {ExpenseEntry} from './expense-report';
export function stockCostExpenses(dispatches:{id:string;orderNumber:string;orderId?:string;tracking:string|null;status:string;dispatchedAt:Date|null;items:unknown}[],roundDates:Map<string,Date>=new Map()):ExpenseEntry[]{
 return dispatches.filter(d=>d.status==='POSTED'&&d.dispatchedAt&&d.tracking).flatMap(d=>(Array.isArray(d.items)?d.items:[]).map((item:StockCostItem)=>({id:'stock-cost:'+d.id+':'+item.code,kind:'PRODUCT_COST' as const,date:roundDates.get(d.orderId??'')??d.dispatchedAt!,description:'ต้นทุนสินค้า · '+item.code+(item.name?' '+item.name:'')+' · '+(item.quantityMilliG/1000)+' G · '+d.orderNumber,amountSatang:item.costSatang,recipient:null,bankName:null,bankAccount:null,tracking:d.tracking!})));
}
export function stockReturnExpenses(returns:{id:string;tracking:string;status:string;receivedAt:Date|null;items:unknown;historySnapshot?:unknown}[]):ExpenseEntry[]{
 return returns.filter(r=>r.status==='POSTED'&&r.receivedAt).flatMap(r=>(Array.isArray(r.items)?r.items:[]).map((item:StockCostItem)=>({id:'stock-return:'+r.id+':'+item.code,kind:'PRODUCT_COST' as const,date:r.receivedAt!,description:'คืนต้นทุนสินค้าตีกลับ · '+item.code+(item.name?' '+item.name:'')+' · '+(item.quantityMilliG/1000)+' G · '+String((r.historySnapshot as {orderNumber?:string}|null)?.orderNumber??r.tracking),amountSatang:-item.costSatang,recipient:null,bankName:null,bankAccount:null,tracking:r.tracking})));
}
