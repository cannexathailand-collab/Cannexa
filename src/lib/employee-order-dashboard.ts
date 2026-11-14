import {visibleOrderWhere} from './order-list-visibility';
import {db} from './db';
import {employeeOrderRange,employeeOrderScope} from './employee-order-history';
import {orderEditVersion} from './order-changes';
import {orderManagement} from './order-management';
import {bangkokDay,shiftDay} from './sales-dates';
import {orderRoundClosingDay} from './order-round';
export function employeeSalesWeekStart(roundDay:string){
 const weekday=new Date(roundDay+'T00:00:00Z').getUTCDay();
 return shiftDay(roundDay,-((weekday+6)%7));
}
export async function employeeOrderDashboard(input:{q?:string;page?:string;scope?:string;range?:string}={},sellerUsername?:string,options:{reviewAllRounds?:boolean}={}){
 const range=options.reviewAllRounds?'round':employeeOrderRange(input);
 const report=await orderManagement({q:input.q,page:range==='all'?'1':input.page},{searchAllRounds:true,...options,...(range==='all'?{reviewAllRounds:true,includeClosed:true}:{})});
 const [systemCount,mySystemCount]=sellerUsername?await Promise.all([db.orderIntake.count({where:visibleOrderWhere}),db.orderIntake.count({where:{...visibleOrderWhere,sellerUsername}})]):[0,0];
 const allRows=report.rows.map(row=>({
  version:orderEditVersion(row.order),canCancel:!row.shipped&&!['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(row.order.status),id:row.order.id,orderNumber:row.order.orderNumber,recipient:row.order.recipient,
  eventAt:row.order.eventAt,createdAt:row.order.createdAt,day:orderRoundClosingDay(row.order.eventAt,report.roundSettings.closeMinutes),
  sellerUsername:row.order.sellerUsername,customerCode:row.order.customerCode,teamName:row.teamName,payment:row.order.payment,phone:row.order.phone,address:row.order.address,rawText:row.order.rawText,
  codReceived:!!row.receipt&&row.receipt.amountSatang===(row.shipment?.codSatang??row.amountSatang),revenueSatang:row.amountSatang,tracking:row.shipment?.tracking??null,hasTracking:!!row.shipment?.tracking,
  state:row.state,confirmationReview:row.confirmationReview,codReview:row.codReview,shipped:row.shipped,
  awaitingShipment:row.awaitingShipment,
 }));
 const ownRows=allRows.filter(row=>row.sellerUsername===sellerUsername);
 const mine=employeeOrderScope(input)==='mine'&&!!sellerUsername;
 const todayRows=mine?ownRows:allRows;
 return {mine,range,systemCount,mySystemCount,allCount:allRows.length,myCount:ownRows.length,query:report.filters.q,page:report.page,pages:report.pages,roundStart:report.round.start,roundEnd:report.round.end,currentRound:bangkokDay(report.round.end),closeTime:report.roundSettings.closeTime,todayRows,
  todayCount:todayRows.length,
  todayAmount:todayRows.filter(row=>!['RETURNED','CANCELLED'].includes(row.state)&&row.payment!=='เคลม').reduce((total,row)=>total+(row.revenueSatang??0),0),
  counts:{ALL:todayRows.length,CANCELLED:todayRows.filter(row=>row.state==='CANCELLED').length,WAITING:todayRows.filter(row=>row.awaitingShipment).length,SHIPPED:todayRows.filter(row=>row.shipped).length,RETURNED:todayRows.filter(row=>row.state==='RETURNED').length,REVIEW:todayRows.filter(row=>row.state==='REVIEW').length},
 };
}
