import {loadOrderRoundSettings} from './order-round-settings';
import {orderRoundClosingDay} from './order-round';
import {dayStart} from './sales-dates';
import {loadDuplicateOrderReviews} from './order-duplicates';
import {db} from './db';
import {commissionPeriod,commissionMonth} from './commission-month';
import {orderState,orderStates} from './order-management';
import {quotedTotal} from './shipment-matching';
export type EmployeeOrderFilters={month?:string;q?:string;status?:string;payment?:string;sort?:string;page?:string};
export async function employeeOrderList(affiliateId:string,username:string,input:EmployeeOrderFilters={}){
 const settings=await loadOrderRoundSettings();
 const currentRound=orderRoundClosingDay(new Date(),settings.closeMinutes);
 const roundDate=(date:Date)=>dayStart(orderRoundClosingDay(date,settings.closeMinutes));
 const duplicateReviews=await loadDuplicateOrderReviews(username,affiliateId);
 const all=await db.orderIntake.findMany({where:{affiliateId,sellerUsername:username},orderBy:[{createdAt:'desc'},{id:'asc'}]});
 const {month,months}=commissionPeriod(all.map(r=>({conversion:{createdAt:roundDate(r.eventAt),verifiedAt:null}})),input.month,dayStart(currentRound));
 const orders=all.filter(r=>commissionMonth(roundDate(r.eventAt))===month),ids=orders.map(r=>r.id);
 const [shipments,sales,extras]=await Promise.all([db.shipment.findMany({where:{orderId:{in:ids}}}),db.salesOrder.findMany({where:{orderId:{in:ids}}}),db.additionalCommission.findMany({where:{affiliateId,orderId:{in:ids}}})]);
 const reports=await db.gmailImport.findMany({where:{id:{in:shipments.map(row=>row.importId)},kind:'SHIPMENT'},select:{id:true}}),verifiedReports=new Set(reports.map(row=>row.id));
 const receipts=await db.codReceipt.findMany({where:{tracking:{in:shipments.map(r=>r.tracking)}}});
 const shipping=new Map(shipments.map(r=>[r.orderId,r])),saleMap=new Map(sales.map(r=>[r.orderId,r])),extraMap=new Map(extras.map(r=>[r.orderId,r])),receiptMap=new Map(receipts.map(r=>[r.tracking,r]));
 const q=(input.q??'').trim().slice(0,100),needle=q.toLocaleLowerCase(),payment=['COD','โอน','เคลม'].includes(input.payment??'')?input.payment!:'ALL',status=Object.hasOwn(orderStates,input.status??'')?input.status as keyof typeof orderStates:'ALL',sort=input.sort==='oldest'?'oldest':'newest',now=new Date();
 const matching=orders.map(order=>{
  const shipment=shipping.get(order.id),sale=saleMap.get(order.id),extra=extraMap.get(order.id),own=sale?.affiliateId===affiliateId?sale:extra;
  const duplicateMatches=duplicateReviews.get(order.id)??[];
  return {order,shipment,duplicateMatches,state:duplicateMatches.length?'REVIEW' as const:orderState(order,shipment,sale,now,shipment?receiptMap.get(shipment.tracking):undefined,!!shipment&&verifiedReports.has(shipment.importId)),amount:quotedTotal(order.rawText??'')??sale?.revenueSatang??null,commission:own?(('amountSatang' in own)?own.amountSatang:own.commissionSatang):null,commissionStatus:own?.status??null};
 }).filter(r=>(payment==='ALL'||r.order.payment===payment)&&(!needle||[r.order.orderNumber,r.order.recipient,r.order.phone,r.order.customerCode,r.shipment?.tracking].some(v=>v?.toLocaleLowerCase().includes(needle))));
 const counts=Object.fromEntries(Object.keys(orderStates).map(k=>[k,k==='ALL'?matching.length:matching.filter(r=>r.state===k).length])) as Record<keyof typeof orderStates,number>;
 const filtered=matching.filter(r=>status==='ALL'||r.state===status);if(sort==='oldest')filtered.reverse();
 const pages=Math.max(1,Math.ceil(filtered.length/25)),page=Math.min(pages,Math.max(1,Number.parseInt(input.page??'1',10)||1));
 return {rows:filtered.slice((page-1)*25,page*25),count:filtered.length,pages,page,counts,month,months,filters:{q,payment,status,sort}};
}
