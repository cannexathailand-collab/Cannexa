import Link from 'next/link';
import type {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
export function EmployeeOrderSummary({data,shared=false}:{data:Awaited<ReturnType<typeof employeeOrderDashboard>>;shared?:boolean}){
 const href=(status?:string)=>'/my-performance/orders?'+new URLSearchParams({...(data.query?{q:data.query}:{}),...(!data.query?{page:String(data.page)}:{}),...(status?{status}:{})});
 const money=(value:number)=>(value/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
 return <section className="employee-order-dashboard" aria-label="สรุปออเดอร์วันนี้">
  <h2>{data.query?'ผลการค้นหาออเดอร์':shared?'ออเดอร์รวมของร้าน':'ออเดอร์ของฉัน'}</h2>
  <p className="small muted">{data.query?'ค้นหาข้ามรอบด้วย “'+data.query+'”':'รอบวันที่ '+data.currentRound+' · เวลาตัดรอบ '+data.closeTime+' น.'}</p>
  <div className="commission-summary-grid employee-order-dashboard-grid">
   <Link className="commission-metric tone-income" href={href()}><span>{data.query?'ออเดอร์ที่พบ':data.page===1?'ออเดอร์วันนี้':'ออเดอร์ในรอบ'}</span><strong>{data.todayCount} <em>รายการ</em></strong><small>ดูออเดอร์ทั้งหมด →</small></Link>
   <Link className="commission-metric tone-income" href={href()}><span>{data.query?'ยอดออเดอร์ที่พบ':data.page===1?'ยอดขายวันนี้':'ยอดขายในรอบ'}</span><strong>{money(data.todayAmount)}</strong><small>{data.query?'ยอดโอนและ COD ที่พบ':'ยอดโอนและ COD ในรอบนี้'}</small></Link>
   {([{key:'WAITING',label:'รอจัดส่ง'},{key:'SHIPPED',label:'จัดส่งแล้ว'},{key:'RETURNED',label:'ตีกลับ / จัดส่งไม่สำเร็จ'},{key:'REVIEW',label:'ต้องตรวจสอบ'}] as const).map(item=><Link className={'commission-metric'+(item.key==='REVIEW'||item.key==='RETURNED'?' employee-order-warning':'')} key={item.key} href={href(item.key)}><span>{item.label}</span><strong>{data.counts[item.key]} <em>รายการ</em></strong><small>ดูรายการ →</small></Link>)}
  </div>
 </section>;
}
