import Link from 'next/link';
import {stockOperators} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
import {orderMatchesState} from '@/lib/order-management';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
export default async function StoreOrders({searchParams}:{searchParams:Promise<{q?:string;page?:string;status?:string}>}){
 await requireAdminPage(stockOperators);
 const input=await searchParams;
 const [data,duplicates]=await Promise.all([employeeOrderDashboard(input),loadDuplicateOrderReviews()]);
 const status=['ALL','WAITING','SHIPPED','REVIEW','RETURNED'].includes(input.status??'')?input.status!:'WAITING';
 const rows=data.todayRows.filter(row=>orderMatchesState(row,status));
 const link=(change:Record<string,string>)=>'/admin/store-orders?'+new URLSearchParams({q:data.query,page:String(data.page),status,...change});
 const labels={ALL:'ออเดอร์ทั้งหมด',WAITING:'เตรียมจัดส่ง',SHIPPED:'จัดส่งแล้ว',REVIEW:'ต้องตรวจสอบ',RETURNED:'ตีกลับ'};
 return <><header className="intro"><div><h1>ออเดอร์เตรียมจัดส่ง</h1><p>ออเดอร์ของผู้ขายทุกคน · รอบวันที่ {data.currentRound} · เวลาตัดรอบ {data.closeTime} น.</p></div><Link className="button" href="/admin/orders/upload">อัปโหลดรายการจัดส่ง</Link></header>
 <form className="form-grid" method="get"><label>ค้นหาออเดอร์<input name="q" defaultValue={data.query} placeholder="รหัสลูกค้า เบอร์โทร หรือเลขพัสดุ"/></label><button>ค้นหา</button></form>
 <nav className="actions" aria-label="สถานะออเดอร์สโตร์">{Object.entries(labels).map(([key,label])=><Link key={key} className="button secondary" aria-current={status===key?'page':undefined} href={link({status:key})}>{label} {data.counts[key as keyof typeof data.counts]}</Link>)}</nav>
 <h2>{labels[status as keyof typeof labels]} · {rows.length} รายการ</h2>
 <div className="employee-order-list">{rows.map(order=><article className={'employee-order-card'+(duplicates.has(order.id)?' duplicate-order-row':'')} key={order.id}><header><strong>{order.orderNumber}</strong><span>{order.state==='RETURNED'?'ตีกลับ':order.hasTracking?'จัดส่งแล้ว':'เตรียมจัดส่ง'}</span></header><p>{order.recipient} · ผู้ขาย {order.sellerUsername}</p><p>สร้าง {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p><p>{order.tracking??'ยังไม่มีเลขพัสดุ'}</p><DuplicateOrderNotice matches={duplicates.get(order.id)??[]} currentOrder={order} baseHref="/admin/store-orders/"/><Link href={'/admin/store-orders/'+encodeURIComponent(order.id)}>ดูสินค้าและรายละเอียดจัดส่ง</Link></article>)}</div>
 {!rows.length&&<p>ไม่มีออเดอร์ในกลุ่มนี้</p>}
 {!data.query&&<nav className="actions" aria-label="รอบออเดอร์">{data.page<data.pages&&<Link href={link({page:String(data.page+1)})}>รอบก่อนหน้า</Link>}{data.page>1&&<Link href={link({page:String(data.page-1)})}>รอบถัดไป</Link>}</nav>}
 </>;
}
