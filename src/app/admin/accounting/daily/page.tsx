import Link from 'next/link';
import {approvers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {accountingReport} from '@/lib/accounting-report';
import {accountingBasis,type AccountingFilters} from '@/lib/accounting-summary';
import {bangkokDay} from '@/lib/sales-dates';
import {profitColors} from '@/lib/profit-colors';
import {AutoFilterForm} from '@/app/auto-filter-form';
const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
export default async function DailyAccounting({searchParams}:{searchParams:Promise<AccountingFilters>}){
 await requireAdminPage(approvers);
 let report;
 try{report=await accountingReport({...await searchParams,view:'day'});}catch(e){
  if(e instanceof Error&&e.message.startsWith('INVALID'))return <><h1>บัญชีรายวัน</h1><p className="notice">เลือกวันที่ให้ถูกต้องและช่วงไม่เกิน 366 วัน <Link href="/admin/accounting/daily">เลือกใหม่</Link></p></>;throw e;
 }
 const {range,total}=report,today=bangkokDay(new Date()),query=new URLSearchParams({...range,view:'day',scope:'journal'});
 const days=[...Map.groupBy(report.journal,row=>bangkokDay(row.date))];
 return <>
  <div className="intro sales-header"><div><div className="eyebrow">ภาพรวมบัญชี</div><h1>บัญชีรายวัน</h1><p>รายการรายรับ รายจ่าย และกำไรสุทธิ แยกตามวัน</p></div><a className="button sales-export" href={'/api/admin/accounting/export?'+query}>↓ ส่งออก CSV</a></div>
  <section className="card"><div className="filters" style={{marginBottom:16}}><Link href={'/admin/accounting/daily?from='+today+'&to='+today}>วันนี้</Link><Link href={'/admin/accounting/daily?month='+today.slice(0,7)}>เดือนนี้</Link><Link href={'/admin/accounting?'+new URLSearchParams(range)}>ดูบัญชีสรุปและกราฟ</Link></div><AutoFilterForm action="/admin/accounting/daily"><label>ตั้งแต่<input name="from" type="date" defaultValue={range.from} required/></label><label>ถึง<input name="to" type="date" defaultValue={range.to} required/></label></AutoFilterForm><p className="muted small">ใช้เวลาประเทศไทย · {accountingBasis}</p></section>
  {!!report.notices.length&&<section className="notice"><strong>ยอดสรุปยังมีรายการค้าง</strong><ul>{report.notices.map(n=><li key={n}>{n}</li>)}</ul></section>}
  <section className="stats">{[[report.notices.length?'สุทธิ (กำไร/ขาดทุนเบื้องต้น)':'สุทธิ (กำไร/ขาดทุน)',total.profitSatang],['รายรับทั้งหมด',total.revenueSatang],['ต้นทุนสินค้า',total.productCostSatang],['รายจ่ายอื่น',total.expenseSatang-total.productCostSatang]].map(([label,value],index)=><article className="card stat" key={label} style={index===0?profitColors(Number(value)):undefined}><span>{label}</span><strong>{money(Number(value))}</strong><span>{range.from} ถึง {range.to}</span></article>)}</section>
  <p className="muted small">สุทธิ = รายรับ − ต้นทุนสินค้า − รายจ่ายอื่น · สุทธิสะสมเริ่มใหม่ในแต่ละวัน · กำไรไม่ใช่ยอดบัญชีธนาคาร · รายการคืนต้นทุนแสดงเป็นรายจ่ายติดลบ</p>
  {!days.length?<section className="card empty">ยังไม่มีรายรับหรือรายจ่ายในช่วงนี้</section>:days.map(([day,rows])=>{
   const cost=rows.filter(row=>row.kind==='PRODUCT_COST').reduce((sum,row)=>sum+row.expenseSatang,0),income=rows.reduce((n,r)=>n+r.incomeSatang,0),expense=rows.reduce((n,r)=>n+r.expenseSatang,0),opening=rows[0].balanceSatang-rows[0].incomeSatang+rows[0].expenseSatang;
   return <section className="card" key={day}>
    <div className="intro"><h2>{day}</h2><a className="button secondary" href={'/api/admin/accounting/export?'+new URLSearchParams({from:day,to:day,view:'day',scope:'journal'})}>ส่งออก CSV วันนี้</a></div>
    <div className="stats">{[['สุทธิของวัน (กำไร/ขาดทุน)',income-expense],['รายรับทั้งหมดของวัน',income],['ต้นทุนสินค้าของวัน',cost],['รายจ่ายอื่นของวัน',expense-cost]].map(([label,value],index)=><article className="card stat" key={label} style={index===0?profitColors(Number(value)):undefined}><span>{label}</span><strong>{money(Number(value))}</strong></article>)}</div>
    <div className="table-wrap"><table><thead><tr><th>รายการ</th><th>สุทธิสะสมของวัน</th><th>รายรับ</th><th>ต้นทุนสินค้า</th><th>รายจ่ายอื่น</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td style={{whiteSpace:'normal'}}>{e.description}</td><td style={profitColors(e.balanceSatang-opening)}>{money(e.balanceSatang-opening)}</td><td>{e.incomeSatang?money(e.incomeSatang):'—'}</td><td>{e.kind==='PRODUCT_COST'?money(e.expenseSatang):'—'}</td><td>{e.kind!=='PRODUCT_COST'&&e.expenseSatang?money(e.expenseSatang):'—'}</td></tr>)}</tbody><tfoot><tr><th>รวมประจำวัน</th><td style={profitColors(income-expense)}><strong>{money(income-expense)}</strong></td><td>{money(income)}</td><td>{money(cost)}</td><td>{money(expense-cost)}</td></tr></tfoot></table></div>
   </section>;
  })}
 </>;
}
