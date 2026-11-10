import Link from 'next/link';
import {stockOperators} from '@/lib/accounts';
import {requireStockPage} from '@/lib/store-view';
import {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
import {dispatchReviewReason} from '@/lib/order-tracking-review';
import {orderMatchesState} from '@/lib/order-management';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import {OrderShippingDetails} from '@/app/order-shipping-details';
import {loadOrderShippingItems} from '@/lib/order-shipping-items';
import {storeOrderFilters,storeOrderLabels,storeOrderQuery} from '@/lib/store-order-filters';
export default async function StoreOrders({searchParams}:{searchParams:Promise<{q?:string;page?:string;status?:string}>}){
 await requireStockPage(stockOperators);
 const input=storeOrderFilters(await searchParams),{status}=input;
 const [data,duplicates]=await Promise.all([employeeOrderDashboard({q:input.q},undefined,{reviewAllRounds:true}),loadDuplicateOrderReviews()]);
 const matching=data.todayRows.filter(row=>orderMatchesState(row,status));
 const pages=Math.max(1,Math.ceil(matching.length/25)),page=Math.min(input.page,pages);
 const rows=matching.slice((page-1)*25,page*25);
 const parsed=await loadOrderShippingItems(rows);
 const query=storeOrderQuery({q:data.query,page:String(page),status});
 const link=(change:Record<string,string>)=>'/admin/store-orders?'+storeOrderQuery({q:data.query,page:String(page),status,...change});
 return <><header className="intro"><div><h1>จัดการออเดอร์</h1><p>ออเดอร์ของผู้ขายทุกคน · ข้อมูลทุกรอบ · เวลาตัดรอบ {data.closeTime} น.</p></div><div className="actions"><Link className="button secondary" href="/admin/stock/returns">รับสินค้าตีกลับ</Link><Link className="button" href="/admin/orders/upload">อัปโหลดรายการจัดส่ง</Link></div></header>
 <form className="form-grid store-order-search" method="get"><input type="hidden" name="status" value={status}/><input type="hidden" name="page" value="1"/><label>ค้นหาออเดอร์<input name="q" defaultValue={data.query} placeholder="รหัสลูกค้า เบอร์โทร หรือเลขพัสดุ"/></label><button>ค้นหา</button></form>
 <nav className="actions" aria-label="สถานะออเดอร์สโตร์">{Object.entries(storeOrderLabels).map(([key,label])=><Link key={key} className="button secondary" aria-current={status===key?'page':undefined} href={link({status:key,page:'1'})}>{label} {data.counts[key as keyof typeof data.counts]}</Link>)}</nav>
 <h2>{storeOrderLabels[status]} · {matching.length} รายการ</h2>
 {matching.length>0&&<p className="muted small">แสดง {(page-1)*25+1}–{Math.min(page*25,matching.length)} · หน้า {page} / {pages}</p>}
 <div className="employee-order-list store-preparing-list">{rows.map(order=>{
  const details=parsed.get(order.id)!;
  const items=details.items;
  return <article className={'employee-order-card'+(duplicates.has(order.id)?' duplicate-order-row':'')} key={order.id}>
   <header><strong><Link href={'/admin/store-orders/'+encodeURIComponent(order.id)+'?'+query}>{order.orderNumber}</Link></strong><span>{order.state==='REVIEW'?(order.shipped?'จัดส่งแล้ว · ต้องตรวจสอบ':'ต้องตรวจสอบ'):order.state==='RETURNED'?'ตีกลับ':order.shipped?'จัดส่งแล้ว':'เตรียมจัดส่ง'}</span></header>
   <p>รอบวันที่ {order.day} · สร้าง {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
   <OrderShippingDetails sellerName={order.sellerUsername} teamName={order.teamName} data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.payment,amountSatang:order.revenueSatang,items}} tracking={order.tracking}><Link href={'/admin/store-orders/'+encodeURIComponent(order.id)+'?'+query}>เปิดรายละเอียดออเดอร์</Link></OrderShippingDetails>
   {order.confirmationReview&&<p className="notice">{dispatchReviewReason}</p>}{order.codReview&&<p className="notice">จัดส่ง COD ครบ 10 วัน ยังจับคู่ยอดรับเงินไม่สำเร็จ</p>}{order.state==='REVIEW'&&<p><Link className="button" href={'/admin/store-orders/'+encodeURIComponent(order.id)+'/review?'+query}>เปิดตรวจสอบออเดอร์</Link></p>}
   {details.issues.map(issue=><p className="notice" key={issue}>{issue}</p>)}{details.issues.length>0&&<pre>{order.rawText}</pre>}
   <DuplicateOrderNotice matches={duplicates.get(order.id)??[]} currentOrder={order} baseHref="/admin/store-orders/"/>
  </article>;
 })}</div>
 {!rows.length&&<p>ไม่มีออเดอร์ในกลุ่มนี้</p>}
 {pages>1&&<nav className="actions" aria-label="หน้ารายการออเดอร์">{page>1&&<Link href={link({page:String(page-1)})}>หน้าก่อนหน้า</Link>}{page<pages&&<Link href={link({page:String(page+1)})}>หน้าถัดไป</Link>}</nav>}
 </>;
}
