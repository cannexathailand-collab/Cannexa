import Link from 'next/link';
import {approvers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {accountingReport} from '@/lib/accounting-report';
import {accountingBasis,accountingKinds,type AccountingFilters} from '@/lib/accounting-summary';
import {journalGroups} from '@/lib/accounting-journal';
import {bangkokDay,dayStart} from '@/lib/sales-dates';
import {profitColors} from '@/lib/profit-colors';
import {AutoFilterForm} from '@/app/auto-filter-form';
const groupLabels:Record<string,string>={...accountingKinds,TRANSFER:'รายรับโอน',COD:'รายรับ COD',INCOME:'รายรับ',OTHER:'รายจ่ายอื่น'};
const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
export default async function DailyAccounting({searchParams}:{searchParams:Promise<AccountingFilters>}){
 await requireAdminPage(approvers);
 const filters=await searchParams;
 let report;
 try{report=await accountingReport({...filters,view:'day'});}catch(e){
  if(e instanceof Error&&e.message.startsWith('INVALID'))return <><h1>บัญชีรายวัน</h1><p className="notice">เลือกวันที่ให้ถูกต้องและช่วงไม่เกิน 366 วัน <Link href="/admin/accounting/daily">เลือกใหม่</Link></p></>;throw e;
 }
 const {range,total}=report,today=bangkokDay(new Date()),query=new URLSearchParams({...range,view:'day',scope:'journal'});
 const days=[...Map.groupBy(report.journal,row=>bangkokDay(row.date))];
 const incomeType=['TRANSFER','COD'].includes(filters.incomeType??'')?filters.incomeType:null;
 const incomeDay=days.some(([day])=>day===filters.incomeDay)?filters.incomeDay:null;
 const selectedIncome=incomeType?report.journal.filter(row=>row.kind==='INCOME'&&row.incomeMethod===incomeType&&(!incomeDay||bangkokDay(row.date)===incomeDay)):[];
 const incomeHref=(type:string,day?:string)=>'/admin/accounting/daily?'+new URLSearchParams({...range,incomeType:type,...(day?{incomeDay:day}:{})})+'#income-detail';
 return <>
  <div className="intro sales-header"><div><div className="eyebrow">ภาพรวมบัญชี</div><h1>บัญชีรายวัน</h1><p>รายการรายรับ รายจ่าย และกำไรสุทธิ แยกตามวัน</p></div><a className="button sales-export" href={'/api/admin/accounting/export?'+query}>↓ ส่งออก CSV</a></div>
  <section className="card"><div className="filters" style={{marginBottom:16}}><Link href={'/admin/accounting/daily?from='+today+'&to='+today}>วันนี้</Link><Link href={'/admin/accounting/daily?month='+today.slice(0,7)}>เดือนนี้</Link><Link href={'/admin/accounting?'+new URLSearchParams(range)}>ดูบัญชีสรุปและกราฟ</Link></div><AutoFilterForm action="/admin/accounting/daily"><label>ตั้งแต่<input name="from" type="date" defaultValue={range.from} required/></label><label>ถึง<input name="to" type="date" defaultValue={range.to} required/></label></AutoFilterForm><p className="muted small">ใช้เวลาประเทศไทย · {accountingBasis}</p></section>
  {!!report.notices.length&&<section className="notice"><strong>ยอดสรุปยังมีรายการค้าง</strong><ul>{report.notices.map(n=><li key={n}>{n}</li>)}</ul></section>}
  <section className="stats">{[[report.notices.length?'สุทธิ (กำไร/ขาดทุนเบื้องต้น)':'สุทธิ (กำไร/ขาดทุน)',total.profitSatang],['รายรับทั้งหมด',total.revenueSatang],['ต้นทุนสินค้า',total.productCostSatang],['รายจ่ายอื่น',total.expenseSatang-total.productCostSatang]].map(([label,value],index)=><article className="card stat" key={label} style={index===0?profitColors(Number(value)):undefined}><span>{label}</span><strong>{money(Number(value))}</strong>{label==='รายรับทั้งหมด'&&<div className="accounting-income-split"><Link href={incomeHref('TRANSFER')}>รายรับจากยอดโอน<strong>{money(total.transferSatang)}</strong><small>ดูรายการ →</small></Link><Link href={incomeHref('COD')}>รายรับจาก COD<strong>{money(total.codSatang)}</strong><small>ดูรายการ →</small></Link></div>}<span>{range.from} ถึง {range.to}</span></article>)}</section>
  <p className="muted small">สุทธิ = รายรับ − ต้นทุนสินค้า − รายจ่ายอื่น · สุทธิสะสมเริ่มใหม่ในแต่ละวัน · กำไรไม่ใช่ยอดบัญชีธนาคาร · รายการคืนต้นทุนแสดงเป็นรายจ่ายติดลบ</p>
  {incomeType&&<section className="card" id="income-detail"><div className="intro"><h2>รายการรายรับจาก{incomeType==='COD'?' COD':'ยอดโอน'}{incomeDay?' · '+dayStart(incomeDay).toLocaleDateString('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'}):''}</h2><Link href={'/admin/accounting/daily?'+new URLSearchParams(range)}>ปิดรายการ</Link></div><p>{selectedIncome.length} รายการ · รวม {money(selectedIncome.reduce((sum,row)=>sum+row.incomeSatang,0))}</p><div className="table-wrap"><table><thead><tr><th>วันที่รับรู้รายรับ</th><th>ชื่อผู้รับ</th><th>ออเดอร์</th><th>เลขพัสดุ</th><th>ยอดเงิน</th></tr></thead><tbody>{selectedIncome.map(row=><tr key={row.id}><td>{row.date.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</td><td>{row.recipient??'ยังไม่ระบุชื่อผู้รับ'}</td><td>{row.orderId?<Link href={'/admin/orders/list/'+encodeURIComponent(row.orderId)}>{row.orderNumber??'ดูออเดอร์'}</Link>:'รับเงินแล้ว · รอจับคู่ออเดอร์'}</td><td>{row.tracking??'—'}</td><td>{money(row.incomeSatang)}</td></tr>)}</tbody></table></div></section>}
  {!days.length?<section className="card empty">ยังไม่มีรายรับหรือรายจ่ายในช่วงนี้</section>:days.map(([day,rows])=>{
   const cost=rows.filter(row=>row.kind==='PRODUCT_COST').reduce((sum,row)=>sum+row.expenseSatang,0),income=rows.reduce((n,r)=>n+r.incomeSatang,0),expense=rows.reduce((n,r)=>n+r.expenseSatang,0),opening=rows[0].balanceSatang-rows[0].incomeSatang+rows[0].expenseSatang;
   const groups=journalGroups(rows),transfer=groups.find(group=>group.key==='TRANSFER')?.incomeSatang??0,cod=groups.find(group=>group.key==='COD')?.incomeSatang??0;
   return <details className="card accounting-day" key={day}>
    <summary><span className="accounting-day-heading"><span><strong>{dayStart(day).toLocaleDateString('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'})}</strong><small>{rows.length} รายการ · กดดูหมวดรายการ</small></span><strong style={profitColors(income-expense)}>สุทธิ {money(income-expense)}</strong></span>
    <span className="accounting-day-totals">{[['รายรับ',income],['ต้นทุนสินค้า',cost],['รายจ่ายอื่น',expense-cost]].map(([label,value])=><span key={label}><small>{label}</small><strong>{money(Number(value))}</strong>{label==='รายรับ'&&<span className="accounting-income-split"><Link href={incomeHref('TRANSFER',day)}>รายรับจากยอดโอน<strong>{money(transfer)}</strong><small>ดูรายการ →</small></Link><Link href={incomeHref('COD',day)}>รายรับจาก COD<strong>{money(cod)}</strong><small>ดูรายการ →</small></Link></span>}</span>)}</span></summary>
    {groups.map(group=><details className="accounting-group" key={group.key}><summary><span>{groupLabels[group.key]??group.key} <small>({group.entries.length} รายการ)</small></span><strong>{money(group.incomeSatang-group.expenseSatang)}</strong></summary><ul>{group.entries.map(entry=><li key={entry.id}><div>{entry.description}<small>สุทธิสะสมของวัน {money(entry.balanceSatang-opening)}</small></div><strong>{money(entry.incomeSatang-entry.expenseSatang)}</strong></li>)}</ul></details>)}
    <a className="button secondary" href={'/api/admin/accounting/export?'+new URLSearchParams({from:day,to:day,view:'day',scope:'journal'})}>ส่งออก CSV วันนี้</a>
   </details>;
  })}
 </>;
}
