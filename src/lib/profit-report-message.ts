import {bangkokDay,dayStart,shiftDay} from './sales-dates';
import {orderRoundBounds} from './order-round';
export function lastClosedProfitRound(now:Date,closeMinutes:number){
 const today=bangkokDay(now);
 const day=+now>=+orderRoundBounds(today,closeMinutes).end?today:shiftDay(today,-1);
 return {day,...orderRoundBounds(day,closeMinutes)};
}
type ReportSummary={revenueSatang:number;transferSatang:number;codSatang:number;costSatang:number;profitSatang:number|null;count:number;estimatedCostCount:number;missingCostCount:number;unknownAmountCount?:number};
export function profitReportText(day:string,closeTime:string,summary:ReportSummary){
 const money=(value:number)=>(value/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท';
 const date=dayStart(day).toLocaleDateString('th-TH',{dateStyle:'long',timeZone:'Asia/Bangkok'});
 return [
  'สรุปยอดขายและกำไรขั้นต้น',
  'รอบวันที่ '+date+' · ตัดรอบ '+closeTime+' น.',
  'ยอดขาย '+money(summary.revenueSatang)+' · '+summary.count+' ออเดอร์',
  'ยอดโอน '+money(summary.transferSatang),
  'ยอด COD '+money(summary.codSatang),
  'ต้นทุนสินค้า '+money(summary.costSatang),
  'กำไรขั้นต้น '+(summary.profitSatang===null?'รอต้นทุนครบ':money(summary.profitSatang)),
  summary.missingCostCount?'ยังขาดต้นทุน '+summary.missingCostCount+' ออเดอร์':summary.estimatedCostCount?'มีต้นทุนประมาณการก่อนจัดส่ง '+summary.estimatedCostCount+' ออเดอร์':'ใช้ต้นทุนสินค้าที่บันทึกแล้ว',
  ...(summary.unknownAmountCount?['มีออเดอร์ยอดเงินไม่ครบ '+summary.unknownAmountCount+' ออเดอร์']:[]),
  'ข้อมูล ณ เวลาส่งรายงาน',
 ].join('\n');
}
