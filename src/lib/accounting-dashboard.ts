import type {AccountingSummary} from './accounting-summary';
import {expenseBreakdown} from './expense-breakdown';
export function dashboardData(report:AccountingSummary&{sources:{name:string;revenueSatang:number}[];notices:string[]}){
 return {
  range:report.range,view:report.view,pending:report.notices.length>0,
  rows:report.rows.map(r=>({day:r.day,revenueSatang:r.revenueSatang,expenseSatang:r.expenseSatang,profitSatang:r.profitSatang})),
  expenses:expenseBreakdown(report.entries),
  sources:report.sources.filter(s=>s.revenueSatang>0).map(s=>({label:s.name,amountSatang:s.revenueSatang})),
  total:{revenueSatang:report.total.revenueSatang,expenseSatang:report.total.expenseSatang,profitSatang:report.total.profitSatang},
 };
}
export type DashboardData=ReturnType<typeof dashboardData>;
export type DashboardPeriod='range'|'day'|'month'|'year';
export function dashboardRange(period:DashboardPeriod,date:string,base:DashboardData['range']){
 if(period==='range')return base;
 const year=Number(date.slice(0,4)),month=Number(date.slice(5,7));
 if(!Number.isInteger(year)||year<2000||year>2100)throw Error('INVALID_YEAR');
 if(period==='year')return {from:year+'-01-01',to:year+'-12-31'};
 if(!Number.isInteger(month)||month<1||month>12)throw Error('INVALID_MONTH');
 if(period==='month')return {from:date.slice(0,7)+'-01',to:date.slice(0,7)+'-'+new Date(Date.UTC(year,month,0)).getUTCDate()};
 return {from:date.slice(0,10),to:date.slice(0,10)};
}
