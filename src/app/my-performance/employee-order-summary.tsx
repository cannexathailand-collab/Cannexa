import Link from 'next/link';
import type {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
export function EmployeeOrderSummary({data,shared=false}:{data:Awaited<ReturnType<typeof employeeOrderDashboard>>;shared?:boolean}){
 const money=(value:number)=>(value/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
 return <section className="employee-order-dashboard" aria-label="ออเดอร์วันนี้ สัปดาห์นี้ และเดือนนี้"><h2>{shared?'ออเดอร์รวมของร้าน':'ออเดอร์ของฉัน'}</h2><p className="small muted">รอบวันที่ {data.currentRound} · เวลาตัดรอบ {data.closeTime} น. · สะสมสัปดาห์นี้ตั้งแต่รอบวันจันทร์</p><div className="commission-summary-grid employee-order-dashboard-grid">
  <Link className="commission-metric tone-income" href="/my-performance/today"><span>ออเดอร์วันนี้</span><strong>{data.todayCount} <em>รายการ</em></strong><small>รวมรอส่งและจัดส่งแล้ว · ดูออเดอร์ →</small></Link>
  <Link className="commission-metric tone-income" href="/my-performance/today"><span>ยอดขายวันนี้</span><strong>{money(data.todayAmount)}</strong><small>ยอดโอนและ COD ในรอบนี้</small></Link>
  <Link className="commission-metric tone-income" href="/my-performance/today?view=week"><span>ออเดอร์สะสมสัปดาห์นี้</span><strong>{data.weekCount} <em>รายการ</em></strong><small>ดูออเดอร์ของสัปดาห์ →</small></Link>
  <Link className="commission-metric tone-income" href="/my-performance/today?view=week"><span>ยอดขายสะสมสัปดาห์นี้</span><strong>{money(data.weekAmount)}</strong><small>ตั้งแต่ {data.weekStart} ถึง {data.currentRound}</small></Link>
  <Link className="commission-metric tone-income" href="/my-performance/today?view=month"><span>ออเดอร์สะสมเดือนนี้</span><strong>{data.monthCount} <em>รายการ</em></strong><small>ตามวันที่ปิดรอบในเดือน {data.month}</small></Link>
  <Link className="commission-metric tone-income" href="/my-performance/today?view=month"><span>ยอดขายสะสมเดือนนี้</span><strong>{money(data.monthAmount)}</strong><small>ดูออเดอร์ของเดือน →</small></Link>
 </div></section>;
}
