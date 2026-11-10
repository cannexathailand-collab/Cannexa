import Link from 'next/link';
import {requireAdminPage} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import '@/app/daily-profit-ledger.css';
import {dayStart} from '@/lib/sales-dates';
import {bookedSalesReport} from '@/lib/booked-sales';
import type {SalesFilters} from '@/lib/sales-report';

const money=(value:number)=>(value/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
export default async function ProfitDay({params,searchParams}:{params:Promise<{day:string}>;searchParams:Promise<SalesFilters&{ledgerMonth?:string;ledgerDay?:string}>}){
 await requireAdminPage(approvers);
 const {day}=await params,filters=await searchParams;
 let data;try{data=await bookedSalesReport({...filters,from:day,to:day})}catch(error){if(error instanceof Error&&error.message.startsWith('INVALID'))return <p className="notice">วันที่ไม่ถูกต้อง <Link href="/admin/sales/profit">กลับบัญชีกำไรรายวัน</Link></p>;throw error;}
 const query=new URLSearchParams({from:filters.from??day,to:filters.to??day,payment:data.payment,seller:data.seller,...(filters.ledgerMonth!==undefined?{ledgerMonth:filters.ledgerMonth}:{}),...(filters.ledgerDay!==undefined?{ledgerDay:filters.ledgerDay}:{}),...(filters.demo==='1'?{demo:'1'}:{})});
 const {summary}=data;
 return <><header className="intro"><div><h1>กำไรรอบวันที่ {dayStart(day).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium'})}</h1><p>{data.roundStart.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})} ถึงก่อน {data.roundEnd.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p></div><Link className="button secondary" href={'/admin/sales/profit?'+query}>กลับบัญชีกำไรรายวัน</Link></header>{filters.demo==='1'&&<p className="notice">ข้อมูลจำลองสำหรับทดสอบ</p>}
  <section className="stats" aria-label="กำไรของวันปิดรอบ"><article className="card stat"><span>ยอดขาย</span><strong>{money(summary.revenueSatang)}</strong><small>{summary.count} ออเดอร์</small></article><article className="card stat"><span>ต้นทุนสินค้า</span><strong>{summary.missingCostCount?'ข้อมูลไม่ครบ':money(summary.costSatang)}</strong></article><article className="card stat tone-income"><span>กำไรหลังต้นทุนสินค้า</span><strong>{summary.profitSatang===null?'รอข้อมูล':money(summary.profitSatang)}</strong></article></section>
  {(summary.missingCostCount>0||summary.unknownAmountCount>0)&&<p className="notice">รอต้นทุน {summary.missingCostCount} ออเดอร์ · ยังไม่ทราบยอดขาย {summary.unknownAmountCount} ออเดอร์</p>}{summary.estimatedCostCount>0&&<p className="notice">มีต้นทุนประมาณการ {summary.estimatedCostCount} ออเดอร์ ยอดกำไรจะอัปเดตเมื่อบันทึกต้นทุนจริง</p>}
  <section className="card daily-profit-ledger"><h2>รายการในรอบนี้</h2><div className="table-wrap"><table><thead><tr><th>ออเดอร์</th><th>ลูกค้า</th><th>การชำระเงิน</th><th>ยอดขาย</th><th>ต้นทุนสินค้า</th><th>กำไร</th><th>สถานะต้นทุน</th></tr></thead><tbody>{data.orderRows.map(row=><tr key={row.id}><td data-label="ออเดอร์">{filters.demo==='1'?row.orderNumber:<Link href={'/admin/orders/list/'+encodeURIComponent(row.id)}>{row.orderNumber}</Link>}</td><td data-label="ลูกค้า">{row.recipient||'—'}</td><td data-label="การชำระเงิน">{row.paymentMethod==='COD'?(row.codPaid?'COD รับเงินแล้ว':'COD รอรับเงิน'):'โอน'}</td><td data-label="ยอดขาย">{row.revenueSatang===null?'รอข้อมูล':money(row.revenueSatang)}</td><td data-label="ต้นทุนสินค้า">{row.costSatang===null?'รอข้อมูล':money(row.costSatang)}</td><td data-label="กำไร">{row.costSatang===null||row.revenueSatang===null?'รอข้อมูล':money(row.revenueSatang-row.costSatang)}</td><td data-label="สถานะต้นทุน">{row.costSatang===null?'ข้อมูลไม่ครบ':row.estimatedCost?'ประมาณการ':'บันทึกแล้ว'}</td></tr>)}</tbody></table></div>{!data.orderRows.length&&<p>ไม่มีออเดอร์ในรอบนี้</p>}</section>
  <p className="muted small">ยอดตามออเดอร์รวมโอนและ COD กำไรหักเฉพาะต้นทุนสินค้า และอัปเดตตามข้อมูลที่บันทึกล่าสุด</p>
 </>;
}
