import {orderEditVersion} from './order-changes';
import {orderManagement} from './order-management';
import {bangkokDay,shiftDay} from './sales-dates';
import {orderRoundClosingDay} from './order-round';
export function employeeSalesWeekStart(roundDay:string){
 const weekday=new Date(roundDay+'T00:00:00Z').getUTCDay();
 return shiftDay(roundDay,-((weekday+6)%7));
}
export async function employeeOrderDashboard(input:{q?:string;page?:string}={}){
 const report=await orderManagement(input,{searchAllRounds:true});
 const todayRows=report.rows.map(row=>({
  version:orderEditVersion(row.order),canCancel:!row.shipped&&!['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(row.order.status),id:row.order.id,orderNumber:row.order.orderNumber,recipient:row.order.recipient,
  eventAt:row.order.eventAt,createdAt:row.order.createdAt,day:orderRoundClosingDay(row.order.eventAt,report.roundSettings.closeMinutes),
  sellerUsername:row.order.sellerUsername,payment:row.order.payment,
  revenueSatang:row.amountSatang,tracking:row.shipment?.tracking??null,hasTracking:!!row.shipment?.tracking,
  state:row.state,shipped:!!row.shipment?.tracking&&row.state!=='RETURNED',
  awaitingShipment:!row.shipment?.tracking&&row.state!=='RETURNED',
 }));
 return {query:report.filters.q,page:report.page,pages:report.pages,roundStart:report.round.start,roundEnd:report.round.end,currentRound:bangkokDay(report.round.end),closeTime:report.roundSettings.closeTime,todayRows,
  todayCount:todayRows.length,
  todayAmount:todayRows.filter(row=>row.state!=='RETURNED'&&row.payment!=='เคลม').reduce((total,row)=>total+(row.revenueSatang??0),0),
  counts:{ALL:todayRows.length,WAITING:todayRows.filter(row=>row.awaitingShipment).length,SHIPPED:todayRows.filter(row=>row.shipped).length,RETURNED:todayRows.filter(row=>row.state==='RETURNED').length,REVIEW:todayRows.filter(row=>row.state==='REVIEW').length},
 };
}
