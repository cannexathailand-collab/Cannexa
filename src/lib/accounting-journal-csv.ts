import {csvCell} from './policy';
import {bangkokDay} from './sales-dates';
import type {JournalRow} from './accounting-journal';
export function accountingJournalCsv(report:{range:{from:string;to:string};journal:JournalRow[];notices:string[]}){
 const amount=(n:number)=>(n/100).toFixed(2);
 const rows:(string|number)[][]=[['บัญชีรายวัน',report.range.from,report.range.to],...report.notices.map(n=>['หมายเหตุ',n]),[],['วันที่','รายการ','สุทธิสะสมของวัน (บาท)','รายรับ (บาท)','รายจ่ายรวมต้นทุน (บาท)','ต้นทุนสินค้า (บาท)','รายจ่ายอื่น (บาท)']];
 let allIncome=0,allExpense=0,allCost=0;
 for(const [day,entries] of Map.groupBy(report.journal,e=>bangkokDay(e.date))){
  let income=0,expense=0,cost=0;
  for(const e of entries){income+=e.incomeSatang;expense+=e.expenseSatang;const entryCost=e.kind==='PRODUCT_COST'?e.expenseSatang:0;cost+=entryCost;rows.push([day,e.description,amount(income-expense),amount(e.incomeSatang),amount(e.expenseSatang),amount(entryCost),amount(e.expenseSatang-entryCost)]);}
  rows.push([day,'รวมประจำวัน',amount(income-expense),amount(income),amount(expense),amount(cost),amount(expense-cost)],[]);allIncome+=income;allExpense+=expense;allCost+=cost;
 }
 rows.push(['รวมช่วงที่เลือก','สุทธิทั้งช่วง',amount(allIncome-allExpense),amount(allIncome),amount(allExpense),amount(allCost),amount(allExpense-allCost)]);
 return '\uFEFF'+rows.map(row=>row.map(v=>typeof v==='number'?String(v):/^-?\d+\.\d{2}$/.test(v)?v:csvCell(v)).join(',')).join('\r\n');
}
