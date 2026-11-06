import Link from 'next/link';
import {db} from '@/lib/db';
export async function StockReservationStatus(){
 const rows=await db.stockReservation.findMany({where:{status:'QUEUED'},orderBy:{createdAt:'asc'},take:30});
 if(!rows.length)return null;
 return <section className="card"><h2>รายการรอเพิ่มจำนวนรอจ่าย</h2><p className="muted">รายการเหล่านี้ยังไม่ได้รวมในจำนวนรอจ่ายและยังไม่ลดคงเหลือ</p>{rows.map(r=><div className="notice" key={r.orderId}><Link href={'/admin/orders/'+encodeURIComponent(r.orderId)+'/review'}>{r.orderNumber}</Link><p>{Array.isArray(r.issues)&&r.issues.length?r.issues.map(String).join(' · '):'รอประมวลผล'}</p></div>)}<form method="post" action="/api/admin/stock/reservations/retry"><button className="secondary">ตรวจรายการรอจ่ายอีกครั้ง</button></form></section>;
}
