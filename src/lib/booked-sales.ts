import type {OrderIntake, SalesOrder, Shipment, CodReceipt, WebsiteOrder} from '@prisma/client';
import {db} from './db';
import {quotedTotal} from './shipment-matching';
import {salesSources, type SaleCustomer, type SalesFilters} from './sales-report';
import {salesRange, shiftDay, shiftMonth, compareRevenue, bangkokDay} from './sales-dates';
import {demoSalesRows} from './sales-demo';

type Order = Pick<OrderIntake,'id'|'orderNumber'|'eventAt'|'rawText'|'status'|'payment'|'sellerUsername'|'affiliateId'|'recipient'> & {customer:SaleCustomer|null};
type Data = {
 orders:Order[];
 sales:Pick<SalesOrder,'orderId'|'revenueSatang'>[];
 shipments:Pick<Shipment,'orderId'|'tracking'|'fulfillmentStatus'>[];
 receipts:Pick<CodReceipt,'tracking'|'amountSatang'>[];
 affiliates:{id:string;name:string;code:string}[];
 websiteOrders?:Pick<WebsiteOrder,'id'|'orderNumber'|'createdAt'|'totalSatang'|'recipient'|'customerCode'|'paymentMethod'|'status'|'intakeOrderId'>[];
};
export type BookedSale = {
 id:string;orderNumber:string;eventAt:Date;day:string;paymentMethod:'TRANSFER'|'COD';
 revenueSatang:number|null;sellerUsername:string|null;affiliateId:string|null;
 affiliate:{id:string;name:string;code:string}|null;customer:SaleCustomer|null;
 recipient:string|null;tracking:string|null;hasTracking:boolean;codPaid:boolean;
};
function totals(rows:BookedSale[]){
 const sum=(items:BookedSale[])=>items.reduce((total,row)=>total+(row.revenueSatang??0),0);
 const transfers=rows.filter(row=>row.paymentMethod==='TRANSFER');
 const cod=rows.filter(row=>row.paymentMethod==='COD');
 const paidCod=cod.filter(row=>row.codPaid);
 return {count:rows.length,revenueSatang:sum(rows),transferSatang:sum(transfers),codSatang:sum(cod),paidCodSatang:sum(paidCod),
  transferCount:transfers.length,codCount:cod.length,paidCodCount:paidCod.length,unknownAmountCount:rows.filter(row=>row.revenueSatang===null).length};
}
export function analyzeBookedSales(data:Data,input:SalesFilters={},now=new Date()){
 const range=salesRange(input,now);
 const sales=new Map(data.sales.map(row=>[row.orderId,row]));
 const shipments=new Map(data.shipments.map(row=>[row.orderId,row]));
 const receipts=new Map(data.receipts.map(row=>[row.tracking,row]));
 const affiliates=new Map(data.affiliates.map(row=>[row.id,row]));
 const payment=['TRANSFER','COD'].includes(input.payment??'')?input.payment!:'';
 const rows:BookedSale[]=data.orders.filter(order=>!['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(order.status)&&['โอน','COD'].includes(order.payment??'')).flatMap(order=>{
  const shipment=shipments.get(order.id);
  if(shipment&&['CANCELLED','RETURNED'].includes(shipment.fulfillmentStatus))return [];
  const paymentMethod:BookedSale["paymentMethod"]=order.payment==='COD'?'COD':'TRANSFER';
  if(payment&&paymentMethod!==payment||input.seller&&order.sellerUsername!==input.seller||input.affiliateId&&order.affiliateId!==input.affiliateId)return [];
  const amount=quotedTotal(order.rawText??'')??sales.get(order.id)?.revenueSatang??null;
  return [{id:order.id,orderNumber:order.orderNumber,eventAt:order.eventAt,day:bangkokDay(order.eventAt),
   paymentMethod,revenueSatang:amount,sellerUsername:order.sellerUsername,affiliateId:order.affiliateId,
   affiliate:affiliates.get(order.affiliateId??'')??null,customer:order.customer,recipient:order.recipient,
   tracking:shipment?.tracking??null,hasTracking:!!shipment?.tracking,
   codPaid:paymentMethod==='COD'&&amount!==null&&!!shipment&&receipts.get(shipment.tracking)?.amountSatang===amount}];
 }).sort((a,b)=>+b.eventAt-+a.eventAt||a.id.localeCompare(b.id));
 const inRange=(from:string,to:string)=>rows.filter(row=>row.day>=from&&row.day<=to);
 const orderRows=inRange(range.from,range.to),summary=totals(orderRows);
 const awaitingShipment=orderRows.filter(row=>!row.hasTracking),shipped=orderRows.filter(row=>row.hasTracking);
 const websiteOrders=(data.websiteOrders??[]).filter(order=>order.status==='PENDING_REVIEW'&&!order.intakeOrderId&&(!payment||order.paymentMethod===payment)&&!input.seller&&!input.affiliateId);
 const pendingWebsiteOrders=websiteOrders.filter(order=>bangkokDay(order.createdAt)>=range.from&&bangkokDay(order.createdAt)<=range.to).sort((a,b)=>+b.createdAt-+a.createdAt);
 const webPending={count:pendingWebsiteOrders.length,revenueSatang:pendingWebsiteOrders.reduce((total,order)=>total+order.totalSatang,0)};
 const availableDays=[...new Set([bangkokDay(now),...rows.map(row=>row.day),...websiteOrders.map(order=>bangkokDay(order.createdAt))])].sort().reverse();
 const waitingCod=orderRows.filter(row=>row.paymentMethod==='COD'&&!row.codPaid);
 const daily=[];
 for(let day=range.from;day<=range.to;day=shiftDay(day,1))daily.push({day,...totals(inRange(day,day))});
 const previous=[{label:'วันก่อนหน้า',from:shiftDay(range.from,-1),to:shiftDay(range.to,-1)},
  {label:'สัปดาห์ก่อน',from:shiftDay(range.from,-7),to:shiftDay(range.to,-7)},
  {label:'เดือนก่อน',from:shiftMonth(range.from,-1),to:shiftMonth(range.to,-1)}]
  .map(period=>({...period,...compareRevenue(summary.revenueSatang,totals(inRange(period.from,period.to)).revenueSatang)}));
 const groups=[...Map.groupBy(orderRows,row=>row.sellerUsername??'affiliate:'+row.affiliateId)].map(([key,items])=>({key,name:items[0].sellerUsername??items[0].affiliate?.name??'ยังไม่ระบุผู้ขาย',code:items[0].affiliate?.code??'',...totals(items)})).sort((a,b)=>b.revenueSatang-a.revenueSatang);
 const details={WEB_PENDING:[] as BookedSale[],ALL:orderRows,WAITING:awaitingShipment,SHIPPED:shipped,TRANSFER:orderRows.filter(row=>row.paymentMethod==='TRANSFER'),COD:orderRows.filter(row=>row.paymentMethod==='COD'),
  COD_PAID:orderRows.filter(row=>row.codPaid),COD_WAITING:waitingCod,RECOGNIZED:orderRows.filter(row=>row.paymentMethod==='TRANSFER'||row.codPaid)};
 const detail=Object.hasOwn(details,input.detail??'')?input.detail as keyof typeof details:'ALL';
 return {range,summary,orderRows,availableDays,webPending,pendingWebsiteOrders,awaitingShipment:totals(awaitingShipment),shipped:totals(shipped),orderTotals:{...summary,amountSatang:summary.revenueSatang},daily,previous,groups,
  sources:salesSources(orderRows.flatMap(row=>row.revenueSatang===null?[]:[{customer:row.customer,revenueSatang:row.revenueSatang}])),
  waitingCodCount:waitingCod.length,waitingCodSatang:totals(waitingCod).revenueSatang,detail,detailRows:details[detail],payment,seller:input.seller??'',
  sellerOptions:[...new Set(data.orders.flatMap(order=>order.sellerUsername?[order.sellerUsername]:[]))].sort()};
}
export async function bookedSalesReport(input:SalesFilters={}){
 if(input.demo==='1'){
  const sample=demoSalesRows();
  return analyzeBookedSales({orders:sample.map(row=>({id:row.orderId,orderNumber:row.order!.orderNumber,eventAt:row.createdAt,rawText:null,status:row.order!.status,payment:row.order!.payment,sellerUsername:row.order!.sellerUsername,affiliateId:row.affiliateId,recipient:null,customer:row.customer??null})),sales:sample,shipments:sample.flatMap(row=>row.shipment?[row.shipment]:[]),receipts:sample.flatMap(row=>row.receipt?[row.receipt]:[]),affiliates:sample.flatMap(row=>row.affiliate?[row.affiliate]:[])},input);
 }
 const [orders,sales,shipments,receipts,affiliates,websiteOrders]=await db.$transaction([
  db.orderIntake.findMany({select:{id:true,orderNumber:true,eventAt:true,rawText:true,status:true,payment:true,sellerUsername:true,affiliateId:true,recipient:true,customer:{select:{code:true,legacy:true,referrerId:true,metaFbc:true,referrer:{select:{name:true,code:true}}}}}}),
  db.salesOrder.findMany({select:{orderId:true,revenueSatang:true}}),
  db.shipment.findMany({where:{orderId:{not:null}},select:{orderId:true,tracking:true,fulfillmentStatus:true}}),
  db.codReceipt.findMany({select:{tracking:true,amountSatang:true}}),
  db.affiliate.findMany({select:{id:true,name:true,code:true}}),
  db.websiteOrder.findMany({where:{status:'PENDING_REVIEW',intakeOrderId:null},select:{id:true,orderNumber:true,createdAt:true,totalSatang:true,recipient:true,customerCode:true,paymentMethod:true,status:true,intakeOrderId:true}}),
 ],{isolationLevel:'RepeatableRead'});
 return analyzeBookedSales({orders,sales,shipments,receipts,affiliates,websiteOrders},input);
}
