import type {BookedSale} from './booked-sales';
import {isRecognizedSale,type SaleRow} from './sales-report';

type Cost={orderId:string;status:string;totalCostSatang:number|null};
export function executivePeriodSummary(booked:BookedSale[],sales:SaleRow[],costs:Cost[],start:Date,end:Date){
 const orders=booked.filter(row=>row.eventAt>=start&&row.eventAt<end);
 const orderIds=new Set(orders.map(row=>row.id));
 const completed=sales.filter(row=>orderIds.has(row.orderId)&&isRecognizedSale(row));
 const byCost=new Map(costs.map(row=>[row.orderId,row]));
 const pendingProfitOrders:{id:string;number:string;tracking:string|null;reason:string}[]=[];
 let knownProfitSatang=0,knownProductCostSatang=0,missingProductCosts=0,estimatedCostCount=0;
 for(const row of orders){
  const recorded=byCost.get(row.id);
  const recordedReady=recorded?.status==='POSTED'&&recorded.totalCostSatang!==null;
  const cost=recordedReady?recorded.totalCostSatang:row.costSatang??null;
  if(cost===null)missingProductCosts++;
  else{
   knownProductCostSatang+=cost;
   if(!recordedReady&&row.estimatedCost)estimatedCostCount++;
  }
  if(cost!==null&&row.revenueSatang!==null)knownProfitSatang+=row.revenueSatang-cost;
  else pendingProfitOrders.push({id:row.id,number:row.orderNumber,tracking:row.tracking,reason:cost===null?'รอต้นทุนสินค้า':'รอยอดออเดอร์'});
 }
 const buyers=new Map<string,number>(),sellers=new Map<string,{name:string;orders:number;amountSatang:number}>();
 for(const row of orders){
  if(row.customer)buyers.set(row.customer.code,(buyers.get(row.customer.code)??0)+1);
  const name=row.sellerUsername??'ยังไม่ระบุผู้ขาย',seller=sellers.get(name)??{name,orders:0,amountSatang:0};
  seller.orders++;seller.amountSatang+=row.revenueSatang??0;sellers.set(name,seller);
 }
 return {
  orderCount:orders.length,orderedSatang:orders.reduce((sum,row)=>sum+(row.revenueSatang??0),0),unknownAmounts:orders.filter(row=>row.revenueSatang===null).length,
  completedCount:completed.length,completedSatang:completed.reduce((sum,row)=>sum+row.revenueSatang,0),
  profitSatang:pendingProfitOrders.length?null:knownProfitSatang,knownProfitSatang,missingProfit:pendingProfitOrders.length,missingProductCosts,pendingProfitOrders,
  productCostSatang:missingProductCosts?null:knownProductCostSatang,estimatedCostCount,
  buyers:buyers.size,repeatBuyers:[...buyers.values()].filter(count=>count>1).length,unknownCustomers:orders.filter(row=>!row.customer).length,
  waitingShipment:orders.filter(row=>!row.hasTracking).length,waitingCod:orders.filter(row=>row.paymentMethod==='COD'&&!row.codPaid).length,
  waitingCodSatang:orders.filter(row=>row.paymentMethod==='COD'&&!row.codPaid).reduce((sum,row)=>sum+(row.revenueSatang??0),0),
  sellers:[...sellers.values()].sort((a,b)=>b.amountSatang-a.amountSatang||a.name.localeCompare(b.name)),
 };
}
