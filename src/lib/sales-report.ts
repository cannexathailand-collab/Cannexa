import type {SalesOrder,Shipment,CodReceipt,OrderIntake} from "@prisma/client";
import {demoSalesRows} from "./sales-demo";
import {db} from "./db";
import {hasActualDispatch} from "./sales-recognition";
import {bangkokDay,salesRange,shiftDay,shiftMonth,compareRevenue} from "./sales-dates";
type OrderInfo=Pick<OrderIntake,"id"|"orderNumber"|"sellerUsername"|"sellerCode"|"payment"|"status">;
type AffiliateInfo={id:string;name:string;code:string};
export type SaleRow=SalesOrder&{order:OrderInfo|null;affiliate:AffiliateInfo|null;shipment:Shipment|null;receipt:CodReceipt|null};
export type SalesFilters={from?:string;to?:string;month?:string;payment?:string;seller?:string;demo?:string};
export function isRecognizedSale(s:SaleRow){
 return !!s.order&&!!s.shipment&&hasActualDispatch(s.shipment)&&!!s.recognizedAt&&s.recognizedAt.getTime()===s.shipment.dispatchedAt!.getTime()&&s.shipment.orderId===s.orderId&&s.tracking===s.shipment.tracking&&s.revenueSatang>0&&["PENDING","PAID","WAITING_COST"].includes(s.status)&&s.order.payment!=="เคลม"&&!['RETURNED','CANCELLED','WITHDRAWN'].includes(s.order.status)&&(s.paymentMethod==="TRANSFER"&&s.order.payment==="โอน"||(s.paymentMethod==="COD"&&s.order.payment==="COD"&&s.receipt?.tracking===s.tracking&&s.receipt.amountSatang===s.revenueSatang&&s.shipment.codSatang===s.revenueSatang));
}
export function summarizeSales(rows:SaleRow[]){
 const included=rows.filter(isRecognizedSale);
 return {rows:included,count:included.length,revenueSatang:included.reduce((n,s)=>n+s.revenueSatang,0),transferSatang:included.filter(s=>s.paymentMethod==="TRANSFER").reduce((n,s)=>n+s.revenueSatang,0),codSatang:included.filter(s=>s.paymentMethod==="COD").reduce((n,s)=>n+s.revenueSatang,0),pendingCommissionSatang:included.filter(s=>s.status==="PENDING").reduce((n,s)=>n+(s.commissionSatang??0),0),paidCommissionSatang:included.filter(s=>s.status==="PAID").reduce((n,s)=>n+(s.paidAmountSatang??s.commissionSatang??0),0),waitingCost:included.filter(s=>s.status==="WAITING_COST").length};
}
export function analyzeSales(rows:SaleRow[],input:SalesFilters={},now=new Date()){
 const range=salesRange(input,now),payment=["TRANSFER","COD"].includes(input.payment??"")?input.payment:undefined;
 const filtered=rows.filter(s=>(!payment||s.paymentMethod===payment)&&(!input.seller||s.order?.sellerUsername===input.seller));
 const inRange=(from:string,to:string)=>filtered.filter(s=>s.shipment?.dispatchedAt&&bangkokDay(s.shipment.dispatchedAt)>=from&&bangkokDay(s.shipment.dispatchedAt)<=to);
 const summary=summarizeSales(inRange(range.from,range.to));
 const previous=[{label:"วันก่อนหน้า",from:shiftDay(range.from,-1),to:shiftDay(range.to,-1)},{label:"สัปดาห์ก่อน",from:shiftDay(range.from,-7),to:shiftDay(range.to,-7)},{label:"เดือนก่อน",from:shiftMonth(range.from,-1),to:shiftMonth(range.to,-1)}].map(period=>({...period,...compareRevenue(summary.revenueSatang,summarizeSales(inRange(period.from,period.to)).revenueSatang)}));
 const daily=[];for(let day=range.from;day<=range.to;day=shiftDay(day,1)){const d=summarizeSales(inRange(day,day));daily.push({day,count:d.count,revenueSatang:d.revenueSatang,transferSatang:d.transferSatang,codSatang:d.codSatang});}
 const groups=[...Map.groupBy(summary.rows,s=>s.order!.sellerUsername??"affiliate:"+s.affiliateId)].map(([key,sales])=>({key,name:sales[0].order!.sellerUsername??sales[0].affiliate?.name??"บัญชีเดิม",code:sales[0].affiliate?.code??"",...summarizeSales(sales)})).sort((a,b)=>b.revenueSatang-a.revenueSatang);
 const waitingCod=filtered.filter(s=>s.order?.payment==="COD"&&!!s.shipment&&hasActualDispatch(s.shipment)&&s.shipment.dispatchedAt&&bangkokDay(s.shipment.dispatchedAt)>=range.from&&bangkokDay(s.shipment.dispatchedAt)<=range.to&&s.receipt?.amountSatang!==s.revenueSatang&&!['RETURNED','CANCELLED','WITHDRAWN'].includes(s.order.status));
 return {range,month:range.from.slice(0,7),summary,groups,daily,previous,payment:payment??"",seller:input.seller??"",waitingCodCount:waitingCod.length,waitingCodSatang:waitingCod.reduce((n,s)=>n+s.revenueSatang,0),sellerOptions:[...new Set(rows.flatMap(s=>s.order?.sellerUsername?[s.order.sellerUsername]:[]))].sort()};
}
export async function salesReport(input?:string|SalesFilters){
 if(typeof input!=="string"&&input?.demo==="1")return analyzeSales(demoSalesRows(),input);
 const sales=await db.salesOrder.findMany({where:{status:{in:["PENDING","PAID","WAITING_COST","WAITING_COD"]}},orderBy:[{recognizedAt:{sort:"desc",nulls:"last"}},{createdAt:"desc"}]});
 const ids=sales.map(s=>s.orderId);
 const [orders,affiliates,shipments,receipts]=await Promise.all([db.orderIntake.findMany({where:{id:{in:ids}},select:{id:true,orderNumber:true,sellerUsername:true,sellerCode:true,payment:true,status:true}}),db.affiliate.findMany({where:{id:{in:[...new Set(sales.map(s=>s.affiliateId))]}},select:{id:true,name:true,code:true}}),db.shipment.findMany({where:{orderId:{in:ids}}}),db.codReceipt.findMany({where:{tracking:{in:sales.flatMap(s=>s.tracking?[s.tracking]:[])}}})]);
 const byOrder=new Map(orders.map(o=>[o.id,o])),byAffiliate=new Map(affiliates.map(a=>[a.id,a])),byShipment=new Map(shipments.map(s=>[s.orderId,s])),byReceipt=new Map(receipts.map(r=>[r.tracking,r]));
 const rows=sales.map(s=>({...s,order:byOrder.get(s.orderId)??null,affiliate:byAffiliate.get(s.affiliateId)??null,shipment:byShipment.get(s.orderId)??null,receipt:s.tracking?byReceipt.get(s.tracking)??null:null}));
 return analyzeSales(rows,typeof input==="string"?{month:input}:input);
}
