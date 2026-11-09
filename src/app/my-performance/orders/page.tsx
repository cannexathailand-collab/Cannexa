import {orderMatchesState} from '@/lib/order-management';
import Link from 'next/link';
import {requireEmployeePage} from '@/lib/employee-view';
import {CancelOwnOrderButton} from '@/app/cancel-own-order-button';
import {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import {EmployeeNav} from '../employee-nav';
import {EmployeeOrderSummary} from '../employee-order-summary';
export default async function EmployeeOrders({searchParams}:{searchParams:Promise<{status?:string;q?:string;page?:string}>}){
 const actor=await requireEmployeePage();
 const input=await searchParams;
 const [data,duplicates]=await Promise.all([employeeOrderDashboard({q:input.q,page:input.page}),loadDuplicateOrderReviews()]);
 const status=['WAITING','SHIPPED','RETURNED','REVIEW'].includes(input.status??'')?input.status!:'ALL';
 const labels:Record<string,string>={ALL:data.page===1?'ออเดอร์ในรอบวันนี้':'ออเดอร์ในรอบที่เลือก',WAITING:'รอจัดส่ง',SHIPPED:'จัดส่งแล้ว',RETURNED:'ตีกลับ / จัดส่งไม่สำเร็จ',REVIEW:'ต้องตรวจสอบ'};
 const rows=data.todayRows.filter(row=>orderMatchesState(row,status));
 const money=(value:number)=>(value/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
 return <main className="center-page performance-page"><section className="customer employee-orders-page"><h1>รายการออเดอร์</h1><p className="muted">ออเดอร์รวมของพนักงานทุกคนที่บันทึกในระบบแล้ว</p><EmployeeNav active="orders"/><form method="get" className="employee-order-search"><label>ค้นหาออเดอร์<input name="q" defaultValue={data.query} placeholder="รหัสลูกค้า เบอร์โทร หรือเลขพัสดุ"/></label><button>ค้นหา</button>{data.query&&<Link href="/my-performance/orders">กลับรอบวันนี้</Link>}</form><EmployeeOrderSummary data={data} shared/>
 <h2>{data.query?'ผลการค้นหา':labels[status]} · {rows.length} รายการ</h2><div className="employee-order-list">{rows.map(order=><article className={'employee-order-card'+(duplicates.has(order.id)?' duplicate-order-row':'')} key={order.id}><header><div><strong>{order.orderNumber}</strong><small>สร้าง {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',second:'2-digit',minute:'2-digit',hour:'2-digit',year:'numeric',month:'short',day:'numeric'})}</small></div><span className="employee-order-status">{order.state==='RETURNED'?'ตีกลับ':order.hasTracking?'จัดส่งแล้ว':'รอจัดส่ง'}</span></header><div className="employee-order-card-body"><div><h3>{order.recipient??'ยังไม่ระบุผู้รับ'}</h3><p>{order.payment??'ยังไม่ระบุ'} · รอบ {order.day}<br/>ผู้ขาย {order.sellerUsername??'ยังไม่ระบุ'}</p><p>{order.tracking??'ยังไม่มีเลขพัสดุ'}</p></div><strong>{order.revenueSatang===null?'รอยอดเงิน':money(order.revenueSatang)}</strong></div><DuplicateOrderNotice matches={duplicates.get(order.id)??[]} currentOrder={order} baseHref="/my-performance/orders/"/><footer><Link href={'/my-performance/orders/'+encodeURIComponent(order.id)}>ดูรายละเอียดออเดอร์ →</Link>{order.canCancel&&order.sellerUsername===actor.username&&<CancelOwnOrderButton id={order.id} version={order.version} orderNumber={order.orderNumber}/>}</footer></article>)}{!rows.length&&<p className="empty">ไม่มีออเดอร์ในช่วงนี้</p>}</div>{!data.query&&<nav className="commission-pagination" aria-label="เลือกรอบออเดอร์">{data.page<data.pages&&<Link href={'/my-performance/orders?'+new URLSearchParams({page:String(data.page+1),status})}>← รอบก่อนหน้า</Link>}<span>รอบวันที่ {data.currentRound}</span>{data.page>1&&<Link href={'/my-performance/orders?'+new URLSearchParams({page:String(data.page-1),status})}>รอบถัดไป →</Link>}</nav>}
 </section></main>;
}
