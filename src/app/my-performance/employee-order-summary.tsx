import Link from 'next/link';
import type {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
export function EmployeeOrderSummary({data,shared=false}:{data:Awaited<ReturnType<typeof employeeOrderDashboard>>;shared?:boolean}){
 const money=(value:number)=>(value/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
 return <section className="employee-order-dashboard" aria-label="สรุปออเดอร์วันนี้">
  <h2>{shared?'ออเดอร์รวมของร้าน':'ออเดอร์ของฉัน'}</h2>
  <p className="small muted">รอบวันที่ {data.currentRound} · เวลาตัดรอบ {data.closeTime} น.</p>
  <div className="commission-summary-grid employee-order-dashboard-grid">
   <Link className="commission-metric tone-income" href="/my-performance/today"><span>ออเดอร์วันนี้</span><strong>{data.todayCount} <em>รายการ</em></strong><small>ดูออเดอร์ทั้งหมด →</small></Link>
   <Link className="commission-metric tone-income" href="/my-performance/today"><span>ยอดขายวันนี้</span><strong>{money(data.todayAmount)}</strong><small>ยอดโอนและ COD ในรอบนี้</small></Link>
   {([{key:'WAITING',label:'รอจัดส่ง'},{key:'SHIPPED',label:'จัดส่งแล้ว'},{key:'RETURNED',label:'ตีกลับ / จัดส่งไม่สำเร็จ'},{key:'REVIEW',label:'ต้องตรวจสอบ'}] as const).map(item=><Link className={'commission-metric'+(item.key==='REVIEW'||item.key==='RETURNED'?' employee-order-warning':'')} key={item.key} href={'/my-performance/today?status='+item.key}><span>{item.label}</span><strong>{data.counts[item.key]} <em>รายการ</em></strong><small>ดูรายการ →</small></Link>)}
  </div>
 </section>;
}
