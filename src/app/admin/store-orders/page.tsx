import Link from 'next/link';
import {stockOperators} from '@/lib/accounts';
import {requireStockPage} from '@/lib/store-view';
import {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
import {orderMatchesState} from '@/lib/order-management';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import {OrderShippingDetails} from '@/app/order-shipping-details';
import {loadOrderShippingItems} from '@/lib/order-shipping-items';
export default async function StoreOrders({searchParams}:{searchParams:Promise<{q?:string;page?:string;status?:string}>}){
 await requireStockPage(stockOperators);
 const input=await searchParams;
 const [data,duplicates]=await Promise.all([employeeOrderDashboard(input),loadDuplicateOrderReviews()]);
 const status=['ALL','WAITING','SHIPPED','REVIEW','RETURNED'].includes(input.status??'')?input.status!:'WAITING';
 const rows=data.todayRows.filter(row=>orderMatchesState(row,status));
 const parsed=await loadOrderShippingItems(rows);
 const link=(change:Record<string,string>)=>'/admin/store-orders?'+new URLSearchParams({q:data.query,page:String(data.page),status,...change});
 const labels={ALL:'ออเดอร์ทั้งหมด',WAITING:'เตรียมจัดส่ง',SHIPPED:'จัดส่งแล้ว',REVIEW:'ต้องตรวจสอบ',RETURNED:'ตีกลับ'};
 return <><header className="intro"><div><h1>ออเดอร์เตรียมจัดส่ง</h1><p>ออเดอร์ของผู้ขายทุกคน · รอบวันที่ {data.currentRound} · เวลาตัดรอบ {data.closeTime} น.</p></div><div className="actions"><Link className="button secondary" href="/admin/stock/returns">รับสินค้าตีกลับ</Link><Link className="button" href="/admin/orders/upload">อัปโหลดรายการจัดส่ง</Link></div></header>
 <form className="form-grid store-order-search" method="get"><label>ค้นหาออเดอร์<input name="q" defaultValue={data.query} placeholder="รหัสลูกค้า เบอร์โทร หรือเลขพัสดุ"/></label><button>ค้นหา</button></form>
 <nav className="actions" aria-label="สถานะออเดอร์สโตร์">{Object.entries(labels).map(([key,label])=><Link key={key} className="button secondary" aria-current={status===key?'page':undefined} href={link({status:key})}>{label} {data.counts[key as keyof typeof data.counts]}</Link>)}</nav>
 <h2>{labels[status as keyof typeof labels]} · {rows.length} รายการ</h2>
 <div className="employee-order-list store-preparing-list">{rows.map(order=>{
  const details=parsed.get(order.id)!;
  const items=details.items;
  return <article className={'employee-order-card'+(duplicates.has(order.id)?' duplicate-order-row':'')} key={order.id}>
   <header><strong>{order.orderNumber}</strong><span>{order.state==='RETURNED'?'ตีกลับ':order.hasTracking?'จัดส่งแล้ว':'เตรียมจัดส่ง'}</span></header>
   <p>สร้าง {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
   <OrderShippingDetails sellerName={order.sellerUsername} teamName={order.teamName} data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.payment,amountSatang:order.revenueSatang,items}} tracking={order.tracking}><Link href={'/admin/store-orders/'+encodeURIComponent(order.id)}>เปิดรายละเอียดออเดอร์</Link></OrderShippingDetails>
   {details.issues.map(issue=><p className="notice" key={issue}>{issue}</p>)}{details.issues.length>0&&<pre>{order.rawText}</pre>}
   <DuplicateOrderNotice matches={duplicates.get(order.id)??[]} currentOrder={order} baseHref="/admin/store-orders/"/>
  </article>;
 })}</div>
 {!rows.length&&<p>ไม่มีออเดอร์ในกลุ่มนี้</p>}
 {!data.query&&<nav className="actions" aria-label="รอบออเดอร์">{data.page<data.pages&&<Link href={link({page:String(data.page+1)})}>รอบก่อนหน้า</Link>}{data.page>1&&<Link href={link({page:String(data.page-1)})}>รอบถัดไป</Link>}</nav>}
 </>;
}
