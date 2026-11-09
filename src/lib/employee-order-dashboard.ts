import {bookedSalesReport} from './booked-sales';
import {bangkokDay,shiftDay} from './sales-dates';
export function employeeSalesWeekStart(roundDay:string){
 const weekday=new Date(roundDay+'T00:00:00Z').getUTCDay();
 return shiftDay(roundDay,-((weekday+6)%7));
}
export async function employeeOrderDashboard(username?:string,affiliateId?:string,now=new Date()){
 const day=bangkokDay(now);
 const report=await bookedSalesReport({seller:username,affiliateId,from:shiftDay(day.slice(0,7)+'-01',-7),to:shiftDay(day,1)},now);
 const weekStart=employeeSalesWeekStart(report.currentRound);
 const weeklyRows=report.orderRows.filter(row=>row.day>=weekStart&&row.day<=report.currentRound&&row.eventAt<=now);
 const month=report.currentRound.slice(0,7);
 const monthlyRows=report.orderRows.filter(row=>row.day.startsWith(month)&&row.day<=report.currentRound&&row.eventAt<=now);
 const todayRows=weeklyRows.filter(row=>row.day===report.currentRound);
 return {currentRound:report.currentRound,closeTime:report.closeTime,weekStart,month,todayRows,weeklyRows,monthlyRows,
  monthCount:monthlyRows.length,monthAmount:monthlyRows.reduce((total,row)=>total+(row.revenueSatang??0),0),
  todayCount:todayRows.length,todayAmount:todayRows.reduce((total,row)=>total+(row.revenueSatang??0),0),
  weekCount:weeklyRows.length,weekAmount:weeklyRows.reduce((total,row)=>total+(row.revenueSatang??0),0)};
}
