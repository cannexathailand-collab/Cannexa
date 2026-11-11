import type {OrderIntake,Shipment,Prisma} from '@prisma/client';
import {db} from './db';
import {isRecognizedSale,type SaleRow} from './sales-report';
import {hasActualDispatch} from './sales-recognition';
import {quotedTotal} from './shipment-matching';
import {orderShipmentStatus} from './order-shipment-status';
import {purchasePoints,type PointRule} from './crm-points';
import {snapshotPoints} from './crm-tier-points';
import {bangkokDay,salesRange} from './sales-dates';
type Cost={orderId:string;status:string;totalCostSatang:number|null};
export type CrmFilters={from?:string;to?:string;view?:string;returns?:string};
export function crmRange(filters:CrmFilters){return salesRange({from:filters.from||'2000-01-01',to:filters.to||bangkokDay(new Date())});}

type CrmOrder=OrderIntake&{paymentSlip?:{orderId:string}|null};
export function summarizeCustomerOrders(orders:CrmOrder[],sales:SaleRow[],shipments:Shipment[]=[],costs:Cost[]=[],rules:PointRule[]=[],filters?:CrmFilters,legacyTransferSlips:ReadonlySet<string>=new Set()){
 const bySale=new Map(sales.map(s=>[s.orderId,s]));
 const byShipment=new Map(shipments.map(s=>[s.orderId,s]));
 const byCost=new Map(costs.map(c=>[c.orderId,c]));
 const history=[...new Map(orders.map(o=>[o.id,o])).values()].map(order=>{
  const sale=bySale.get(order.id),shipment=byShipment.get(order.id)??sale?.shipment;
  const returned=order.payment!=='เคลม'&&(order.status==='RETURNED'||shipment?.status==='RETURNED'||shipment?.fulfillmentStatus==='RETURNED');
  const excluded=!!order.withdrawnAt||['RETURNED','CANCELLED','WITHDRAWN'].includes(order.status)||!!shipment&&['RETURNED','CANCELLED','WITHDRAWN'].includes(shipment.status)||!!shipment&&['RETURNED','CANCELLED'].includes(shipment.fulfillmentStatus)||!['โอน','COD'].includes(order.payment??'');
  const recognized=!excluded&&!!sale&&isRecognizedSale(sale);
  const shipped=returned||!excluded&&!!shipment&&hasActualDispatch(shipment);
  const amountSatang=sale?.revenueSatang??quotedTotal(order.rawText??'');
  const cost=byCost.get(order.id),costReady=cost?.status==='POSTED'&&cost.totalCostSatang!==null;
  const profitSatang=recognized&&costReady?amountSatang!-cost!.totalCostSatang!:null;
  const transferPaid=!excluded&&order.payment==='โอน'&&sale?.paymentMethod==='TRANSFER'&&['PENDING','WAITING_COST','PAID'].includes(sale.status)&&!['NEEDS_REVIEW','EXPIRED'].includes(order.status)&&!!amountSatang&&amountSatang>0&&!!(order.paymentSlip||legacyTransferSlips.has(order.id));
  const pointsEligible=recognized||transferPaid;
  const points=pointsEligible?(snapshotPoints(order.loyaltySnapshot,amountSatang!)??purchasePoints(amountSatang!,transferPaid?order.eventAt:sale!.recognizedAt!,rules)):0;
  return {order,amountSatang,excluded,recognized,recognizedAt:sale?.recognizedAt??null,returned,shipped,productCostSatang:costReady?cost!.totalCostSatang:null,profitSatang,points,pointsEligible,tracking:shipment?.tracking??null,status:returned?'ไม่รับสินค้า · ตีกลับ':recognized?'ซื้อสำเร็จ':excluded?'ไม่นับยอดซื้อ':sale?.status==='WAITING_COD'?'รอรับเงิน COD':order.status==='NEEDS_REVIEW'?'รอตรวจสอบ':orderShipmentStatus(order.status,shipment?.tracking,shipment?.fulfillmentStatus,shipment?.dispatchedAt).label};
 }).sort((a,b)=>+b.order.eventAt-+a.order.eventAt||a.order.id.localeCompare(b.order.id));
 const range=filters?crmRange(filters):null;
 const selected=range?history.filter(h=>{const day=bangkokDay(h.order.eventAt);return day>=range.from&&day<=range.to;}):history;
 const active=selected.filter(h=>!h.excluded),completed=active.filter(h=>h.recognized),pending=active.filter(h=>!h.recognized);
 const total=(rows:typeof history)=>rows.reduce((n,h)=>n+(h.amountSatang??0),0);
 const returnedCount=selected.filter(h=>h.returned).length,shippedCount=selected.filter(h=>h.shipped).length,lifetimeReturnedCount=history.filter(h=>h.returned).length,lifetimeShippedCount=history.filter(h=>h.shipped).length;
 const periods=new Map<string,{period:string;revenueSatang:number;profitSatang:number;pendingCost:number;points:number}>();
 for(const h of completed){const day=bangkokDay(h.order.eventAt),key=filters?.view==='year'?day.slice(0,4):filters?.view==='month'?day.slice(0,7):day;const p=periods.get(key)??{period:key,revenueSatang:0,profitSatang:0,pendingCost:0,points:0};p.revenueSatang+=h.amountSatang!;p.profitSatang+=h.profitSatang??0;p.pendingCost+=h.profitSatang===null?1:0;p.points+=h.points;periods.set(key,p);}
 for(const h of selected.filter(h=>!h.recognized&&h.points>0)){const day=bangkokDay(h.order.eventAt),key=filters?.view==='year'?day.slice(0,4):filters?.view==='month'?day.slice(0,7):day;const p=periods.get(key)??{period:key,revenueSatang:0,profitSatang:0,pendingCost:0,points:0};p.points+=h.points;periods.set(key,p);}
 return {history:selected,allHistory:history,returnedCount,shippedCount,returnPercent:shippedCount?returnedCount/shippedCount*100:null,lifetimeReturnedCount,lifetimeShippedCount,lifetimeReturnPercent:lifetimeShippedCount?lifetimeReturnedCount/lifetimeShippedCount*100:null,orderCount:active.length,purchaseCount:completed.length,orderedSatang:total(active),purchasedSatang:total(completed),pendingSatang:total(pending),pendingCount:pending.length,unknownAmountCount:active.filter(h=>h.amountSatang===null).length,lastOrderedAt:active[0]?.order.eventAt??null,profitSatang:completed.reduce((n,h)=>n+(h.profitSatang??0),0),pendingCostCount:completed.filter(h=>h.profitSatang===null).length,points:selected.reduce((n,h)=>n+h.points,0),lifetimePoints:history.reduce((n,h)=>n+h.points,0),periods:[...periods.values()].sort((a,b)=>b.period.localeCompare(a.period))};
}
export function customerLifetimeStats(summary:ReturnType<typeof summarizeCustomerOrders>,createdAt:Date,now=new Date()){
 const history=summary.allHistory,completed=history.filter(h=>h.recognized),dates=completed.map(h=>h.order.eventAt).sort((a,b)=>+a-+b);
 const since=new Date(Math.min(+createdAt,...history.map(h=>+h.order.eventAt)));
 const startDay=bangkokDay(since),today=bangkokDay(now),months=Math.max(1,(Number(today.slice(0,4))-Number(startDay.slice(0,4)))*12+Number(today.slice(5,7))-Number(startDay.slice(5,7))+1);
 const purchasedSatang=completed.reduce((n,h)=>n+h.amountSatang!,0);
 const profitSatang=completed.reduce((total,order)=>total+(order.profitSatang??0),0),pendingCostCount=completed.filter(order=>order.profitSatang===null).length;
 const currentMonth=completed.filter(h=>bangkokDay(h.order.eventAt).slice(0,7)===today.slice(0,7));
 return {since,days:Math.max(0,Math.floor((Date.parse(today)-Date.parse(startDay))/86400000)),months,currentMonthSpentSatang:currentMonth.reduce((n,h)=>n+h.amountSatang!,0),currentMonthPurchases:currentMonth.length,currentMonthProfitSatang:currentMonth.some(h=>h.profitSatang===null)?null:currentMonth.reduce((n,h)=>n+h.profitSatang!,0),orderedSatang:history.filter(h=>!h.excluded).reduce((n,h)=>n+(h.amountSatang??0),0),orderCount:history.filter(h=>!h.excluded).length,purchasedSatang,purchaseCount:completed.length,profitSatang,pendingCostCount,monthlyProfitAverageSatang:pendingCostCount?null:Math.round(profitSatang/months),monthlyAverageSatang:Math.round(purchasedSatang/months),monthlyOrderAverage:completed.length/months,averageOrderSatang:completed.length?Math.round(purchasedSatang/completed.length):null,averageGapDays:dates.length>1?(+dates[dates.length-1]-+dates[0])/86400000/(dates.length-1):null,lastPurchaseAt:dates.at(-1)??null};
}

export async function loadCustomerCrm(codes:string[],filters?:CrmFilters,client:Prisma.TransactionClient=db){
 const orders=codes.length?await client.orderIntake.findMany({where:{customerCode:{in:codes}},orderBy:{eventAt:'desc'},include:{paymentSlip:{select:{orderId:true}}}}):[];
 const ids=orders.map(o=>o.id);
 const legacyCandidates=orders.filter(order=>order.payment==='โอน'&&!order.paymentSlip).map(order=>order.id);
 const legacySlips=legacyCandidates.length?await client.websiteOrder.findMany({where:{intakeOrderId:{in:legacyCandidates},slipVersion:{not:null},slipData:{not:null}},select:{intakeOrderId:true}}):[];
 const legacySlipIds=new Set(legacySlips.flatMap(order=>order.intakeOrderId?[order.intakeOrderId]:[]));
 const [sales,shipments,costs,rules,redemptions]=await Promise.all([client.salesOrder.findMany({where:{orderId:{in:ids}}}),client.shipment.findMany({where:{orderId:{in:ids}}}),client.stockDispatch.findMany({where:{orderId:{in:ids}},select:{orderId:true,status:true,totalCostSatang:true}}),client.crmPointRule.findMany({orderBy:{effectiveAt:'asc'}}),client.crmRewardRedemption.groupBy({by:['customerCode'],where:{customerCode:{in:codes},status:{in:['PENDING','FULFILLED']}},_sum:{points:true}})]);
 const redeemedByCustomer=new Map(redemptions.map(redemption=>[redemption.customerCode,redemption._sum.points??0]));
 const receipts=shipments.length?await client.codReceipt.findMany({where:{tracking:{in:shipments.map(s=>s.tracking)}}}):[];
 const byOrder=new Map(orders.map(o=>[o.id,o])),byShipment=new Map(shipments.map(s=>[s.orderId,s])),byReceipt=new Map(receipts.map(r=>[r.tracking,r]));
 const rows:SaleRow[]=sales.map(s=>({...s,order:byOrder.get(s.orderId)??null,shipment:byShipment.get(s.orderId)??null,receipt:s.tracking?byReceipt.get(s.tracking)??null:null,affiliate:null}));
 return new Map(codes.map(code=>{
  const customerOrders=orders.filter(o=>o.customerCode===code),orderIds=new Set(customerOrders.map(o=>o.id));
  const summary=summarizeCustomerOrders(customerOrders,rows.filter(s=>orderIds.has(s.orderId)),shipments.filter(s=>!!s.orderId&&orderIds.has(s.orderId)),costs,rules,filters,legacySlipIds);
  const redeemedPoints=redeemedByCustomer.get(code)??0;
  return [code,{...summary,redeemedPoints,availablePoints:summary.lifetimePoints-redeemedPoints}] as const;
 }));
}
export function crmMoney(satang:number){return (satang/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท';}
export function crmDate(date:Date|null){return date?date.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'}):'—';}
export function crmBehaviorTags(summary:ReturnType<typeof summarizeCustomerOrders>){
 const completed=summary.allHistory.filter(h=>h.recognized),active=summary.allHistory.filter(h=>!h.excluded);
 return [completed.length===0?'ยังไม่มียอดซื้อสำเร็จ':completed.length===1?'ซื้อครั้งแรก':'ซื้อซ้ำ',...(active.some(h=>!h.recognized)?['มีออเดอร์รอดำเนินการ']:[]),...(completed.some(h=>h.profitSatang===null)?['รอข้อมูลต้นทุน']:[])];
}
