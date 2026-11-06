import Link from 'next/link';
import {db} from '@/lib/db';
export async function StockReservationStatus(){
 const [rows,counted,reconciling]=await Promise.all([
  db.stockReservation.findMany({where:{status:'QUEUED'},orderBy:{createdAt:'asc'},take:30}),
  db.stockReservation.findMany({where:{status:'ALREADY_COUNTED'},orderBy:{updatedAt:'desc'},take:30}),
  db.stockReservation.count({where:{status:'RECONCILING'}})
 ]);
 return <>
  {reconciling>0&&<section className="card"><p>กำลังกระทบยอดออเดอร์ที่นับในยอดจ่ายเดิมแล้ว {reconciling} รายการ · พักการตัดสต๊อกของรายการเหล่านี้ไว้ก่อน</p></section>}
  {!!counted.length&&<section className="card"><details><summary>ออเดอร์ที่นับในยอดจ่ายเดิมแล้ว · ล่าสุด {counted.length} รายการ</summary><p className="muted">เก็บออเดอร์ไว้ตรวจสอบ โดยไม่นำมารวมจำนวนรอจ่ายหรือตัดสต๊อกซ้ำ</p>{counted.map(r=><p key={r.orderId}><Link href={'/admin/orders/'+encodeURIComponent(r.orderId)+'/review'}>{r.orderNumber}</Link></p>)}</details></section>}
  {!!rows.length&&<section className="card"><h2>รายการรอเพิ่มจำนวนรอจ่าย</h2><p className="muted">รายการเหล่านี้ยังไม่ได้รวมในจำนวนรอจ่ายและยังไม่ลดคงเหลือ</p>{rows.map(r=><div className="notice" key={r.orderId}><Link href={'/admin/orders/'+encodeURIComponent(r.orderId)+'/review'}>{r.orderNumber}</Link>{Array.isArray(r.items)&&<p>{r.items.map((i:any)=>i.code+' '+i.quantityMilliG/1000+' G').join(' · ')}</p>}<p>{Array.isArray(r.issues)&&r.issues.length?r.issues.map(String).join(' · '):'รอประมวลผล'}</p></div>)}<form method="post" action="/api/admin/stock/reservations/retry"><button className="secondary">ตรวจรายการรอจ่ายอีกครั้ง</button></form></section>}
 </>;
}
