import {OrderShippingDetails} from '@/app/order-shipping-details';
import {loadOrderShippingItems} from '@/lib/order-shipping-items';
import {employeeCommissions} from '@/lib/employee-commissions';
import {OrderCommissionStatus,orderCommissionCopyLines} from '../order-commission-status';
import {orderMatchesState} from '@/lib/order-management';
import Link from 'next/link';
import {requireEmployeePage} from '@/lib/employee-view';
import {CancelOwnOrderButton} from '@/app/cancel-own-order-button';
import {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import {EmployeeNav} from '../employee-nav';
import {EmployeeOrderSummary} from '../employee-order-summary';
export default async function EmployeeOrders({searchParams}:{searchParams:Promise<{status?:string;q?:string;page?:string;scope?:string}>}){
 const actor=await requireEmployeePage();
 const input=await searchParams;
 const mine=input.scope==='mine';
 const [data,duplicates,commissions]=await Promise.all([employeeOrderDashboard({q:input.q,page:input.page,scope:input.scope},actor.username),loadDuplicateOrderReviews(),mine&&actor.affiliateId?employeeCommissions(actor.affiliateId):Promise.resolve({rows:[]})]);
 const status=['WAITING','SHIPPED','RETURNED','REVIEW'].includes(input.status??'')?input.status!:'ALL';
 const labels:Record<string,string>={ALL:data.page===1?'ออเดอร์ในรอบวันนี้':'ออเดอร์ในรอบที่เลือก',WAITING:'รอจัดส่ง',SHIPPED:'จัดส่งแล้ว',RETURNED:'ตีกลับ / จัดส่งไม่สำเร็จ',REVIEW:'ต้องตรวจสอบ'};
 const rows=data.todayRows.filter(row=>orderMatchesState(row,status));
 const scopeQuery:Record<string,string>=mine?{scope:'mine'}:{};
 const shipping=await loadOrderShippingItems(rows);
 return <main className="center-page performance-page"><section className="customer employee-orders-page"><h1>รายการออเดอร์</h1><p className="muted">ออเดอร์รวมของพนักงานทุกคนที่บันทึกในระบบแล้ว</p><EmployeeNav active="orders"/><form method="get" className="employee-order-search">{mine&&<input type="hidden" name="scope" value="mine"/>}<label>{mine?'ค้นหาออเดอร์ของฉัน':'ค้นหาออเดอร์ทุกคน'}<input name="q" defaultValue={data.query} placeholder="รหัสลูกค้า เบอร์โทร หรือเลขพัสดุ"/></label><button>ค้นหา</button>{data.query&&<Link href={mine?'/my-performance/orders?scope=mine':'/my-performance/orders'}>กลับรอบวันนี้</Link>}</form><EmployeeOrderSummary data={data} shared={!mine}/>
 <h2>{data.query?'ผลการค้นหา':labels[status]} · {rows.length} รายการ</h2><div className="employee-order-list store-preparing-list">{rows.map(order=><article className={'employee-order-card'+(duplicates.has(order.id)?' duplicate-order-row':'')} key={order.id}><header><div><strong><Link className="employee-order-reference" title="เปิดรายละเอียดออเดอร์" aria-label={'ดูรายละเอียดออเดอร์ '+order.orderNumber} href={'/my-performance/orders/'+encodeURIComponent(order.id)+(mine?'?scope=mine':'')}>{order.orderNumber}</Link></strong><small>สร้าง {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',second:'2-digit',minute:'2-digit',hour:'2-digit',year:'numeric',month:'short',day:'numeric'})}</small></div><span className="employee-order-status">{order.state==='RETURNED'?'ตีกลับ':order.hasTracking?'จัดส่งแล้ว':'รอจัดส่ง'}</span></header><p>ผู้ขาย {order.sellerUsername??'ยังไม่ระบุ'} · รอบ {order.day}</p><OrderShippingDetails copyDetails={{orderNumber:order.orderNumber,seller:order.sellerUsername,createdAt:order.createdAt,status:order.state==='RETURNED'?'ตีกลับ':order.hasTracking?'จัดส่งแล้ว':'รอจัดส่ง',extraLines:orderCommissionCopyLines({visible:mine,payment:order.payment,codReceived:order.codReceived,rows:commissions.rows.filter(row=>row.reference===order.orderNumber)})}} data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.payment,amountSatang:order.revenueSatang,items:shipping.get(order.id)!.items}} tracking={order.tracking}>{order.canCancel&&(actor.role==='owner'||order.sellerUsername===actor.username)&&<CancelOwnOrderButton id={order.id} version={order.version} orderNumber={order.orderNumber}/>}</OrderShippingDetails><OrderCommissionStatus visible={mine} payment={order.payment} codReceived={order.codReceived} rows={commissions.rows.filter(row=>row.reference===order.orderNumber)}/><DuplicateOrderNotice matches={duplicates.get(order.id)??[]} currentOrder={order} baseHref="/my-performance/orders/"/></article>)}{!rows.length&&<p className="empty">ไม่มีออเดอร์ในช่วงนี้</p>}</div>{!data.query&&<nav className="commission-pagination" aria-label="เลือกรอบออเดอร์">{data.page<data.pages&&<Link href={'/my-performance/orders?'+new URLSearchParams({...scopeQuery,page:String(data.page+1),status})}>← รอบก่อนหน้า</Link>}<span>รอบวันที่ {data.currentRound}</span>{data.page>1&&<Link href={'/my-performance/orders?'+new URLSearchParams({...scopeQuery,page:String(data.page-1),status})}>รอบถัดไป →</Link>}</nav>}
 </section></main>;
}
