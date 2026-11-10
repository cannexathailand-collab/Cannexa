import Link from 'next/link';
import {requireAdminPage} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {expenseReport,type ExpenseFilters} from '@/lib/expense-report';
import {groupProductCostExpenses} from '@/lib/stock-cost-expenses';
import {CommissionMonthSelect} from '@/app/commission-month-select';
import {AutoFilterForm} from '@/app/auto-filter-form';
import {ExpenseDetailsButton} from '@/app/expense-details-button';

const path='/admin/accounting/product-costs';
const money=(amount:number)=>(amount/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});

export default async function ProductCosts({searchParams}:{searchParams:Promise<ExpenseFilters>}){
 await requireAdminPage(approvers);
 let report;
 try{report=await expenseReport(await searchParams)}catch(error){
  if(error instanceof Error&&error.message.startsWith('INVALID'))return <p className="notice">ช่วงวันที่ไม่ถูกต้อง <Link href={path}>เลือกวันที่ใหม่</Link></p>;
  throw error;
 }
 const entries=report.entries.filter(entry=>entry.kind==='PRODUCT_COST');
 const days=groupProductCostExpenses(entries);
 const estimated=entries.filter(entry=>entry.estimated).reduce((total,entry)=>total+entry.amountSatang,0);
 return <><header className="intro"><div><div className="eyebrow">บัญชี</div><h1>รายการต้นทุนสินค้า</h1><p className="muted">ต้นทุนตามรอบออเดอร์และรายการคืนต้นทุนจากสินค้าตีกลับ</p></div><Link className="button secondary" href={'/admin/expenses?'+new URLSearchParams(report.range)}>กลับรายจ่าย</Link></header>
  <section className="card"><CommissionMonthSelect action={path} month={report.month} months={report.months} label="เดือนต้นทุนสินค้า"/><AutoFilterForm action={path}><label>ตั้งแต่<input name="from" type="date" defaultValue={report.range.from} required/></label><label>ถึง<input name="to" type="date" defaultValue={report.range.to} required/></label></AutoFilterForm></section>
  <section className="stats" aria-label="สรุปต้นทุนสินค้า"><article className="card stat tone-expense"><span>ต้นทุนสินค้ารวม</span><strong>{money(report.productCostSatang)}</strong><small>ตามช่วงวันที่เลือก</small></article><article className="card stat"><span>ต้นทุนบันทึกจริงสุทธิ</span><strong>{money(report.productCostSatang-estimated)}</strong><small>รวมรายการคืนต้นทุน</small></article><article className="card stat"><span>ต้นทุนประมาณการ</span><strong>{money(estimated)}</strong><small>{report.estimatedCostCount} ออเดอร์</small></article></section>
  {report.missingOrderCostCount>0&&<p className="notice">ยังคำนวณต้นทุนไม่ได้ {report.missingOrderCostCount} ออเดอร์ กรุณาตรวจข้อมูลสินค้าและต้นทุน</p>}
  <section className="card"><h2>รายการต้นทุนสินค้าแยกตามวัน</h2><p className="muted">กดดูรายการเพื่อเปิดต้นทุนสินค้าและเลขออเดอร์ รายการคืนต้นทุนแสดงเป็นยอดติดลบ</p><div className="table-wrap"><table className="expense-ledger financial-expense-table"><thead><tr><th>วันที่</th><th>รายการ</th><th>จำนวนรายการ</th><th>ต้นทุนสินค้า</th></tr></thead><tbody>{days.map(day=><tr key={day.id}><th>{day.date.toLocaleDateString('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'})}</th><td><ExpenseDetailsButton title={'ต้นทุนสินค้า · '+day.date.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})} label="ดูรายการต้นทุนสินค้า" entries={day.details??[day]}/>{day.estimated&&<small className="order-meta">มีต้นทุนประมาณการ</small>}</td><td>{day.details?.length??1}</td><td className="tone-expense">{money(day.amountSatang)}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>รวม</th><td className="tone-expense">{money(report.productCostSatang)}</td></tr></tfoot></table></div>{!days.length&&<p>ไม่มีรายการต้นทุนสินค้าในช่วงนี้</p>}</section>
  <p className="muted small">ต้นทุนก่อนจัดส่งเป็นประมาณการ เมื่อบันทึกตัดสต๊อกสำเร็จจะใช้ต้นทุนจริง โดยนับตามวันปิดรอบออเดอร์เดียวกับหน้ารายจ่าย</p>
 </>;
}
