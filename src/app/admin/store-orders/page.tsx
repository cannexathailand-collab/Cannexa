import Link from 'next/link';
import {stockOperators} from '@/lib/accounts';
import {requireStockPage} from '@/lib/store-view';
import {employeeOrderDashboard} from '@/lib/employee-order-dashboard';
import {orderMatchesState} from '@/lib/order-management';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import {CopyOrderShipping} from '@/app/copy-order-shipping';
import {shippingSummaryText,shippingPaymentLabel,shippingAmountLabel} from '@/lib/order-shipping-summary';
import {orderStockItems} from '@/lib/order-stock-items';
import {db} from '@/lib/db';
export default async function StoreOrders({searchParams}:{searchParams:Promise<{q?:string;page?:string;status?:string}>}){
 await requireStockPage(stockOperators);
 const input=await searchParams;
 const [data,duplicates]=await Promise.all([employeeOrderDashboard(input),loadDuplicateOrderReviews()]);
 const status=['ALL','WAITING','SHIPPED','REVIEW','RETURNED'].includes(input.status??'')?input.status!:'WAITING';
 const rows=data.todayRows.filter(row=>orderMatchesState(row,status));
 const parsed=new Map(rows.map(order=>[order.id,orderStockItems(order.rawText)]));
 const codes=[...new Set([...parsed.values()].flatMap(value=>value.items.map(item=>item.code)))];
 const products=codes.length?await db.stockProduct.findMany({where:{code:{in:codes}},select:{code:true,name:true}}):[];
 const names=new Map(products.map(product=>[product.code,product.name]));
 const link=(change:Record<string,string>)=>'/admin/store-orders?'+new URLSearchParams({q:data.query,page:String(data.page),status,...change});
 const labels={ALL:'ออเดอร์ทั้งหมด',WAITING:'เตรียมจัดส่ง',SHIPPED:'จัดส่งแล้ว',REVIEW:'ต้องตรวจสอบ',RETURNED:'ตีกลับ'};
 return <><header className="intro"><div><h1>ออเดอร์เตรียมจัดส่ง</h1><p>ออเดอร์ของผู้ขายทุกคน · รอบวันที่ {data.currentRound} · เวลาตัดรอบ {data.closeTime} น.</p></div><Link className="button" href="/admin/orders/upload">อัปโหลดรายการจัดส่ง</Link></header>
 <form className="form-grid" method="get"><label>ค้นหาออเดอร์<input name="q" defaultValue={data.query} placeholder="รหัสลูกค้า เบอร์โทร หรือเลขพัสดุ"/></label><button>ค้นหา</button></form>
 <nav className="actions" aria-label="สถานะออเดอร์สโตร์">{Object.entries(labels).map(([key,label])=><Link key={key} className="button secondary" aria-current={status===key?'page':undefined} href={link({status:key})}>{label} {data.counts[key as keyof typeof data.counts]}</Link>)}</nav>
 <h2>{labels[status as keyof typeof labels]} · {rows.length} รายการ</h2>
 <div className="employee-order-list">{rows.map(order=>{
  const details=parsed.get(order.id)!;
  const items=details.items.map(item=>({...item,name:names.get(item.code)??null}));
  const text=shippingSummaryText({orderNumber:order.orderNumber,recipient:order.recipient,phone:order.phone,address:order.address,payment:order.payment,amountSatang:order.revenueSatang,tracking:order.tracking,seller:order.sellerUsername,items});
  return <article className={'employee-order-card'+(duplicates.has(order.id)?' duplicate-order-row':'')} key={order.id}>
   <header><strong>{order.orderNumber}</strong><span>{order.state==='RETURNED'?'ตีกลับ':order.hasTracking?'จัดส่งแล้ว':'เตรียมจัดส่ง'}</span></header>
   <p>ผู้ขาย {order.sellerUsername??'ยังไม่ระบุ'} · สร้าง {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
   <dl className="store-shipping-facts">
    <div><dt>ชื่อผู้รับ</dt><dd>{order.recipient||'ยังไม่ระบุ'}</dd></div>
    <div><dt>เบอร์โทร</dt><dd>{order.phone||'ยังไม่ระบุ'}</dd></div>
    <div className="shipping-address"><dt>ที่อยู่จัดส่ง</dt><dd>{order.address||'ยังไม่ระบุ'}</dd></div>
    <div><dt>การชำระเงิน</dt><dd>{shippingPaymentLabel(order.payment)}</dd></div>
    <div><dt>ยอดรวม</dt><dd>{shippingAmountLabel(order.revenueSatang)}</dd></div>
    <div><dt>เลขพัสดุ</dt><dd>{order.tracking??'ยังไม่มีเลขพัสดุ'}</dd></div>
   </dl>
   <h3>สินค้าที่ต้องจัด</h3><ul>{items.map(item=><li key={item.code}><strong>{item.code}</strong>{item.name?' · '+item.name:''} · {(item.quantityMilliG/1000).toLocaleString('th-TH',{maximumFractionDigits:3})} G</li>)}</ul>
   {details.issues.map(issue=><p className="notice" key={issue}>{issue}</p>)}{details.issues.length>0&&<pre>{order.rawText}</pre>}
   <DuplicateOrderNotice matches={duplicates.get(order.id)??[]} currentOrder={order} baseHref="/admin/store-orders/"/>
   <div className="actions"><CopyOrderShipping text={details.issues.length?text+'\n\nข้อความออเดอร์ต้นฉบับ\n'+(order.rawText??''):text}/><Link href={'/admin/store-orders/'+encodeURIComponent(order.id)}>เปิดรายละเอียดออเดอร์</Link></div>
  </article>;
 })}</div>
 {!rows.length&&<p>ไม่มีออเดอร์ในกลุ่มนี้</p>}
 {!data.query&&<nav className="actions" aria-label="รอบออเดอร์">{data.page<data.pages&&<Link href={link({page:String(data.page+1)})}>รอบก่อนหน้า</Link>}{data.page>1&&<Link href={link({page:String(data.page-1)})}>รอบถัดไป</Link>}</nav>}
 </>;
}
