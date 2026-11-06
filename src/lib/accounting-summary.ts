import {bangkokDay,dayStart,DAY_MS,salesRange,shiftDay,shiftMonth} from './sales-dates';
import type {ExpenseEntry} from './expense-report';
import {csvCell} from './policy';
import type {JournalRow} from './accounting-journal';

export type AccountingFilters={from?:string;to?:string;month?:string;view?:string};
export type AccountingRange={from:string;to:string};
export type RevenueDay={day:string;count:number;revenueSatang:number;transferSatang:number;codSatang:number};
export type AccountingRow=RevenueDay&{productCostSatang:number;lineSatang:number;recurringSatang:number;freightSatang:number;commissionSatang:number;expenseSatang:number;profitSatang:number};
export const accountingKinds:Record<ExpenseEntry['kind'],string>={PRODUCT_COST:'ต้นทุนสินค้า',LINE:'รายจ่ายจาก LINE',RECURRING:'รายจ่ายประจำ',FREIGHT:'ค่าส่งและค่าธรรมเนียม',FRIEND:'ค่าคอมเพิ่มเพื่อน',SALE:'ค่าคอมยอดขาย',SPECIAL:'ค่าคอมพิเศษ'};
export const accountingBasis='ยอดขายตามเกณฑ์หน้ายอดขาย; ต้นทุนตามวันที่จัดส่งและรับคืน; รายจ่าย LINE และค่าคอมตามวันที่จ่าย; รายจ่ายประจำตามวันที่ลงรายการ; ค่าขนส่งตามวันที่เรียกเก็บ ยอดย้อนหลังอาจเปลี่ยนเมื่อได้รับข้อมูลเพิ่มหรือแก้สถานะออเดอร์';
export function accountingRange(input:AccountingFilters,now=new Date()){
 const range=salesRange(input,now);
 if((+dayStart(range.to)-+dayStart(range.from))/DAY_MS>365)throw Error('INVALID_ACCOUNTING_RANGE');
 return range;
}
export function accountingMonthRange(month:string,range:AccountingRange){
 const first=month+'-01',last=shiftDay(shiftMonth(first,1),-1);
 return {from:range.from>first?range.from:first,to:range.to<last?range.to:last,view:'day'};
}
function empty(day:string):AccountingRow{return {day,count:0,revenueSatang:0,transferSatang:0,codSatang:0,productCostSatang:0,lineSatang:0,recurringSatang:0,freightSatang:0,commissionSatang:0,expenseSatang:0,profitSatang:0};}
const fields=['count','revenueSatang','transferSatang','codSatang','productCostSatang','lineSatang','recurringSatang','freightSatang','commissionSatang','expenseSatang','profitSatang'] as const;
function add(target:AccountingRow,source:AccountingRow){for(const field of fields)target[field]+=source[field];}
function dailyFreightEntries(entries:ExpenseEntry[]):ExpenseEntry[]{
 const other=entries.filter(e=>e.kind!=='FREIGHT');
 const freight=Map.groupBy(entries.filter(e=>e.kind==='FREIGHT'),e=>bangkokDay(e.date));
 const grouped=[...freight].map(([day,rows]):ExpenseEntry=>({
  id:'freight-day:'+day,kind:'FREIGHT',date:dayStart(day),
  description:'ค่าจัดส่งรวมประจำวัน ('+rows.length+' พัสดุ)',
  amountSatang:rows.reduce((sum,e)=>sum+e.amountSatang,0),recipient:null,bankName:null,bankAccount:null
 }));
 return [...other,...grouped].sort((a,b)=>+b.date-+a.date||a.id.localeCompare(b.id));
}
export function summarizeAccounting(range:AccountingRange,revenue:RevenueDay[],expenses:ExpenseEntry[],view='day'){
 const days=new Map<string,AccountingRow>();
 for(let day=range.from;day<=range.to;day=shiftDay(day,1))days.set(day,empty(day));
 for(const sale of revenue){const row=days.get(sale.day);if(row){row.count+=sale.count;row.revenueSatang+=sale.revenueSatang;row.transferSatang+=sale.transferSatang;row.codSatang+=sale.codSatang;}}
 const unique=new Map<string,ExpenseEntry>();
 for(const entry of expenses){
  if(!days.has(bangkokDay(entry.date)))continue;
  const key=entry.kind+':'+entry.id,previous=unique.get(key);
  if(previous){if(previous.amountSatang!==entry.amountSatang||+previous.date!==+entry.date)throw Error('ACCOUNTING_DUPLICATE_CONFLICT');continue;}
  unique.set(key,entry);
  const row=days.get(bangkokDay(entry.date))!;
  const field={PRODUCT_COST:'productCostSatang',LINE:'lineSatang',RECURRING:'recurringSatang',FREIGHT:'freightSatang',FRIEND:'commissionSatang',SALE:'commissionSatang',SPECIAL:'commissionSatang'} as const;
  row[field[entry.kind]]+=entry.amountSatang;
  row.expenseSatang+=entry.amountSatang;
 }
 const daily=[...days.values()];for(const row of daily)row.profitSatang=row.revenueSatang-row.expenseSatang;
 const monthly=new Map<string,AccountingRow>(),yearly=new Map<string,AccountingRow>(),total=empty('รวม');
 for(const row of daily){add(total,row);const month=row.day.slice(0,7),year=row.day.slice(0,4);if(!monthly.has(month))monthly.set(month,empty(month));add(monthly.get(month)!,row);if(!yearly.has(year))yearly.set(year,empty(year));add(yearly.get(year)!,row);}
 return {range,view:view==='year'?'year':view==='month'?'month':'day',daily,rows:view==='year'?[...yearly.values()]:view==='month'?[...monthly.values()]:daily,total,entries:dailyFreightEntries([...unique.values()])};
}
export type AccountingSummary=ReturnType<typeof summarizeAccounting>;
export function accountingCsv(report:AccountingSummary&{journal?:JournalRow[];sources?:{name:string;customers:number;orders:number;revenueSatang:number}[]},notices:string[]=[]){
 const numeric=(n:number)=>(n/100).toFixed(2);
 const line=(r:AccountingRow)=>[r.day,numeric(r.profitSatang),r.count,numeric(r.revenueSatang),numeric(r.transferSatang),numeric(r.codSatang),numeric(r.productCostSatang),numeric(r.lineSatang),numeric(r.recurringSatang),numeric(r.freightSatang),numeric(r.commissionSatang),numeric(r.expenseSatang)];
 const rows:(string|number)[][]=[['บัญชีสรุป',report.view==='year'?'รายปี':report.view==='month'?'รายเดือน':'รายวัน',report.range.from,report.range.to],['เกณฑ์การคำนวณ',accountingBasis],...notices.map(n=>['หมายเหตุ',n]),[],['งวด','กำไร/ขาดทุนตามรายการที่บันทึก (บาท)','จำนวนยอดขาย','ยอดขาย (บาท)','ยอดโอน (บาท)','ยอด COD (บาท)','ต้นทุนสินค้าสุทธิ (บาท)','รายจ่าย LINE (บาท)','รายจ่ายประจำ (บาท)','ค่าขนส่ง (บาท)','ค่าคอมจ่ายแล้ว (บาท)','ต้นทุนและค่าใช้จ่ายรวม (บาท)'],...report.rows.map(line),line(report.total),[],['รายละเอียดต้นทุนและค่าใช้จ่าย'],['วันที่','เลขรายการ','ประเภท','รายละเอียด','จำนวนเงิน (บาท)'],...report.entries.map(e=>[bangkokDay(e.date),e.id,accountingKinds[e.kind],e.description,numeric(e.amountSatang)])];
 if(report.sources)rows.push([],['ยอดขายตามแหล่งที่มา'],['ช่องทาง / ผู้แนะนำ','ลูกค้าที่ซื้อไม่ซ้ำ','ออเดอร์','ยอดขาย (บาท)'],...report.sources.map(s=>[s.name,s.customers,s.orders,numeric(s.revenueSatang)]));
 if(report.journal)rows.push([],['บัญชีรายวัน'],['วันที่','รายการ','สุทธิสะสมในช่วงที่เลือก (บาท)','รายรับ (บาท)','รายจ่าย (บาท)'],...report.journal.map(r=>[r.date.toLocaleString('sv-SE',{timeZone:'Asia/Bangkok'}),r.description,numeric(r.balanceSatang),numeric(r.incomeSatang),numeric(r.expenseSatang)]));
 return '\uFEFF'+rows.map(row=>row.map(v=>typeof v==='number'?String(v):/^-?\d+\.\d{2}$/.test(v)?v:csvCell(v)).join(',')).join('\r\n');
}
