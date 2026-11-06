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
export type DashboardFilters={from:string;to:string;view:'day'|'month'|'year'};
export function dashboardQuery(filters:DashboardFilters){
 for(const value of [filters.from,filters.to]){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('เลือกวันที่ให้ครบ');
  const date=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)throw Error('เลือกวันที่ให้ถูกต้อง');
 }
 if(filters.from>filters.to)throw Error('วันที่สิ้นสุดต้องไม่อยู่ก่อนวันที่เริ่มต้น');
 if((+new Date(filters.to)-+new Date(filters.from))/86400000>365)throw Error('เลือกช่วงวันที่ไม่เกิน 366 วัน');
 return new URLSearchParams(filters).toString();
}
