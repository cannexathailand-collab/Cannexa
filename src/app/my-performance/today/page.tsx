import {orderMatchesState} from '@/lib/order-management';
import Link from 'next/link';
import {requireEmployeePage} from '@/lib/employee-view';
import {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import {EmployeeNav} from '../employee-nav';
import {EmployeeOrderSummary} from '../employee-order-summary';
export default async function EmployeeToday({searchParams}:{searchParams:Promise<{status?:string}>}){
 await requireEmployeePage();
 const [data,duplicates,input]=await Promise.all([employeeOrderDashboard(),loadDuplicateOrderReviews(),searchParams]);
 const status=['WAITING','SHIPPED','RETURNED','REVIEW'].includes(input.status??'')?input.status!:'ALL';
 const labels:Record<string,string>={ALL:'ออเดอร์ในรอบวันนี้',WAITING:'รอจัดส่ง',SHIPPED:'จัดส่งแล้ว',RETURNED:'ตีกลับ / จัดส่งไม่สำเร็จ',REVIEW:'ต้องตรวจสอบ'};
 const rows=data.todayRows.filter(row=>orderMatchesState(row,status));
 const money=(value:number)=>(value/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
 return <main className="center-page performance-page"><section className="customer employee-orders-page"><h1>ออเดอร์วันนี้</h1><p className="muted">ออเดอร์รวมของพนักงานทุกคนที่บันทึกในระบบแล้ว</p><EmployeeNav active="today"/><EmployeeOrderSummary data={data} shared/>
 <h2>{labels[status]} · {rows.length} รายการ</h2><div className="employee-order-list">{rows.map(order=><article className={'employee-order-card'+(duplicates.has(order.id)?' duplicate-order-row':'')} key={order.id}><header><div><strong>{order.orderNumber}</strong><small>{order.eventAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</small></div><span className="employee-order-status">{order.state==='RETURNED'?'ตีกลับ':order.hasTracking?'จัดส่งแล้ว':'รอจัดส่ง'}</span></header><div className="employee-order-card-body"><div><h3>{order.recipient??'ยังไม่ระบุผู้รับ'}</h3><p>{order.payment??'ยังไม่ระบุ'} · รอบ {order.day}<br/>ผู้ขาย {order.sellerUsername??'ยังไม่ระบุ'}</p><p>{order.tracking??'ยังไม่มีเลขพัสดุ'}</p></div><strong>{order.revenueSatang===null?'รอยอดเงิน':money(order.revenueSatang)}</strong></div><DuplicateOrderNotice matches={duplicates.get(order.id)??[]} baseHref="/my-performance/today/"/><footer><Link href={'/my-performance/today/'+encodeURIComponent(order.id)}>ดูรายละเอียดออเดอร์ →</Link></footer></article>)}{!rows.length&&<p className="empty">ไม่มีออเดอร์ในช่วงนี้</p>}</div>
 </section></main>;
}
