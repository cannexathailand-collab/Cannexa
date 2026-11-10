import Link from 'next/link';
import type {employeeOrderDashboard} from '@/lib/employee-order-dashboard';

export function EmployeeOrderSummary({data,shared=false}:{data:Awaited<ReturnType<typeof employeeOrderDashboard>>;shared?:boolean}){
 const allTime=data.range==='all';
 const href=(status?:string)=>'/my-performance/orders?'+new URLSearchParams({
  ...(data.mine?{scope:'mine'}:{}),...(allTime?{range:'all'}:{page:String(data.page)}),
  ...(data.query&&!status?{q:data.query}:{}),...(status?{status}:{}),
 });
 const money=(value:number)=>(value/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
 return <section className="employee-order-dashboard" aria-label="สรุปรายการออเดอร์">
  <h2>{data.query?'ผลการค้นหาทั้งระบบ':shared?'ออเดอร์รวมของร้าน':'ออเดอร์ของฉัน'}</h2>
  <p className="small muted">{allTime?'ข้อมูลทุกช่วงวันที่'+(data.query?' · ค้นหา “'+data.query+'”':''):'รอบวันที่ '+data.currentRound+' · เวลาตัดรอบ '+data.closeTime+' น.'}</p>
  <div className="commission-summary-grid employee-order-dashboard-grid">
   <Link className="commission-metric tone-income" href="/my-performance/orders" aria-current={!allTime&&!data.mine?'page':undefined}><span>{!allTime&&data.page>1?'ออเดอร์ในรอบ':'ออเดอร์วันนี้'}</span><strong>{allTime?'ดูวันนี้':data.allCount}<em>{allTime?'':' รายการ'}</em></strong><small>ดูตามรอบวันที่ →</small></Link>
   <Link className="commission-metric tone-income" href="/my-performance/orders?range=all" aria-current={allTime&&!data.mine?'page':undefined}><span>ออเดอร์ทั้งหมดในระบบ</span><strong>{data.systemCount} <em>รายการ</em></strong><small>ทุกคน · ทุกช่วงวันที่ →</small></Link>
   <Link className="commission-metric tone-income" href="/my-performance/orders?range=all&scope=mine" aria-current={data.mine?'page':undefined}><span>ออเดอร์ของฉัน</span><strong>{data.mySystemCount} <em>รายการ</em></strong><small>เฉพาะของฉัน · ทุกช่วงวันที่ →</small></Link>
   <Link className="commission-metric tone-income" href={href()}><span>{data.query?'ยอดออเดอร์ที่พบ':allTime?'ยอดขายทุกช่วงวันที่':data.page===1?'ยอดขายวันนี้':'ยอดขายในรอบ'}</span><strong>{money(data.todayAmount)}</strong><small>ยอดโอนและ COD ตามมุมมองที่เลือก</small></Link>
   {([{key:'WAITING',label:'รอจัดส่ง'},{key:'SHIPPED',label:'จัดส่งแล้ว'},{key:'RETURNED',label:'ตีกลับ / จัดส่งไม่สำเร็จ'},{key:'REVIEW',label:'ต้องตรวจสอบ'}] as const).map(item=><Link className={'commission-metric'+(item.key==='REVIEW'||item.key==='RETURNED'?' employee-order-warning':'')} key={item.key} href={href(item.key)}><span>{item.label}</span><strong>{data.counts[item.key]} <em>รายการ</em></strong><small>ดูรายการ →</small></Link>)}
  </div>
 </section>;
}
