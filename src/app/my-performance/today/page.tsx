import Link from 'next/link';
import {requireEmployeePage} from '@/lib/employee-view';
import {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import {EmployeeNav} from '../employee-nav';
import {EmployeeOrderSummary} from '../employee-order-summary';
export default async function EmployeeToday({searchParams}:{searchParams:Promise<{view?:string}>}){
 const actor=await requireEmployeePage();
 if(!actor.affiliateId)return <main className="center-page performance-page"><section className="customer"><h1>ออเดอร์วันนี้</h1><EmployeeNav active="today"/><p>{actor.role==='owner'?'เลือกรายชื่อพนักงานด้านบนเพื่อดูข้อมูล':'ยังไม่ได้ผูกบัญชีกับ Affiliate'}</p></section></main>;
 const [data,duplicates,input]=await Promise.all([employeeOrderDashboard(actor.username,actor.affiliateId),loadDuplicateOrderReviews(actor.username,actor.affiliateId),searchParams]);
 const weekly=input.view==='week',monthly=input.view==='month',rows=monthly?data.monthlyRows:weekly?data.weeklyRows:data.todayRows;
 const money=(value:number)=>(value/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
 return <main className="center-page performance-page"><section className="customer employee-orders-page"><h1>ออเดอร์วันนี้</h1><p className="muted">{actor.username} · ออเดอร์ที่บันทึกในระบบแล้ว</p><EmployeeNav active="today"/><EmployeeOrderSummary data={data}/>
 <div className="employee-task-types"><Link className={!weekly&&!monthly?'active':''} href="/my-performance/today">รอบวันนี้</Link><Link className={weekly?'active':''} href="/my-performance/today?view=week">สะสมสัปดาห์นี้</Link><Link className={monthly?'active':''} href="/my-performance/today?view=month">สะสมเดือนนี้</Link><Link href="/my-performance/monthly">ผลงานและค่าคอมรายเดือน</Link></div>
 <h2>{monthly?'ออเดอร์สะสมเดือนนี้':weekly?'ออเดอร์สะสมสัปดาห์นี้':'ออเดอร์ในรอบวันนี้'} · {rows.length} รายการ</h2><div className="employee-order-list">{rows.map(order=><article className={'employee-order-card'+(duplicates.has(order.id)?' duplicate-order-row':'')} key={order.id}><header><div><strong>{order.orderNumber}</strong><small>{order.eventAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</small></div><span className="employee-order-status">{order.hasTracking?'จัดส่งแล้ว':'รอจัดส่ง'}</span></header><div className="employee-order-card-body"><div><h3>{order.recipient??'ยังไม่ระบุผู้รับ'}</h3><p>{order.paymentMethod==='COD'?'COD':'โอน'} · รอบ {order.day}</p><p>{order.tracking??'ยังไม่มีเลขพัสดุ'}</p></div><strong>{order.revenueSatang===null?'รอยอดเงิน':money(order.revenueSatang)}</strong></div><DuplicateOrderNotice matches={duplicates.get(order.id)??[]} employee/><footer><Link href={'/my-performance/orders/'+encodeURIComponent(order.id)}>ดูรายละเอียดออเดอร์ →</Link></footer></article>)}{!rows.length&&<p className="empty">ไม่มีออเดอร์ในช่วงนี้</p>}</div>
 </section></main>;
}
