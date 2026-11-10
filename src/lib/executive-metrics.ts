import type {BookedSale} from './booked-sales';
import {isRecognizedSale,type SaleRow} from './sales-report';

type Cost={orderId:string;status:string;totalCostSatang:number|null};
export function executivePeriodSummary(booked:BookedSale[],sales:SaleRow[],costs:Cost[],start:Date,end:Date){
 const orders=booked.filter(row=>row.eventAt>=start&&row.eventAt<end);
 const completed=sales.filter(row=>isRecognizedSale(row)&&row.shipment!.dispatchedAt!>=start&&row.shipment!.dispatchedAt!<end);
 const byCost=new Map(costs.map(row=>[row.orderId,row]));
 const pendingProfitOrders:{id:string;number:string;tracking:string|null;reason:string}[]=[];
 let knownProfitSatang=0,freightSatang=0,missingProductCosts=0,missingFreight=0,missingProfit=0;
 for(const row of completed){
  const cost=byCost.get(row.orderId);
  const productReady=cost?.status==='POSTED'&&cost.totalCostSatang!==null;
  const freightReady=row.shipment!.freightSatang!==null&&!!row.shipment!.freightReportAt;
  if(!productReady)missingProductCosts++;
  else knownProfitSatang+=row.revenueSatang-cost!.totalCostSatang!;
  if(!freightReady)missingFreight++;
  else freightSatang+=row.shipment!.freightSatang!;
  if(!productReady||!freightReady){missingProfit++;pendingProfitOrders.push({id:row.orderId,number:row.order!.orderNumber,tracking:row.tracking,reason:[!productReady?'รอต้นทุนสินค้า':'',!freightReady?'รอค่าส่ง':''].filter(Boolean).join(' · ')});continue;}
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
  profitSatang:missingProductCosts?null:knownProfitSatang,knownProfitSatang,freightSatang,missingProfit,missingProductCosts,missingFreight,pendingProfitOrders,
  buyers:buyers.size,repeatBuyers:[...buyers.values()].filter(count=>count>1).length,unknownCustomers:orders.filter(row=>!row.customer).length,
  waitingShipment:orders.filter(row=>!row.hasTracking).length,waitingCod:orders.filter(row=>row.paymentMethod==='COD'&&!row.codPaid).length,
  waitingCodSatang:orders.filter(row=>row.paymentMethod==='COD'&&!row.codPaid).reduce((sum,row)=>sum+(row.revenueSatang??0),0),
  sellers:[...sellers.values()].sort((a,b)=>b.amountSatang-a.amountSatang||a.name.localeCompare(b.name)),
 };
}
