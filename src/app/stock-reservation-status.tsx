import Link from 'next/link';
import {db} from '@/lib/db';
export async function StockReservationStatus(){
 const [pending,counted,reconciling]=await Promise.all([
  db.stockReservation.findMany({where:{status:{in:['QUEUED','RESERVED']}},orderBy:{createdAt:'asc'}}),
  db.stockReservation.count({where:{status:'ALREADY_COUNTED'}}),
  db.stockReservation.count({where:{status:'RECONCILING'}})
 ]);
 const queued=pending.filter(r=>r.status==='QUEUED');
 return <>
  {reconciling>0&&<section className="card"><p>กำลังกระทบยอด {reconciling} ออเดอร์</p></section>}
  {counted>0&&<section className="card"><p>ออเดอร์ที่นับในยอดจ่ายเดิมแล้ว {counted} รายการ · ยังไม่ใช้สถานะนี้ยืนยันว่าจัดส่งจริงแล้ว</p></section>}
  {!!pending.length&&<section className="card"><h2>ออเดอร์รอจัดส่ง {pending.length} รายการ</h2><p>รวมในจำนวนรอจ่ายแล้ว {pending.length-queued.length} รายการ · รอจับคู่หรือตรวจสอบ {queued.length} รายการ</p><details><summary>ดูรายการรอจัดส่งทั้งหมด</summary>{pending.map(r=><div className="notice" key={r.orderId}><Link href={'/admin/orders/'+encodeURIComponent(r.orderId)+'/review'}>{r.orderNumber}</Link>{Array.isArray(r.items)&&<p>{r.items.map((i:any)=>i.code+' '+i.quantityMilliG/1000+' G').join(' · ')}</p>}{r.precounted&&<p>รวมอยู่ในยอดจ่ายเดิมแล้ว · ยังคงรอจัดส่งและจะไม่หักคงเหลือซ้ำ</p>}{r.needsReconciliation&&<p>รอเทียบเลขออเดอร์กับยอดจ่ายเดิม · ยังไม่ตัดคงเหลือซ้ำ</p>}<p>{r.status==='RESERVED'?'รอจัดส่ง':Array.isArray(r.issues)&&r.issues.length?r.issues.map(String).join(' · '):'รอประมวลผล'}</p></div>)}</details>{!!queued.length&&<form method="post" action="/api/admin/stock/reservations/retry"><button className="secondary">ตรวจรายการรอจ่ายอีกครั้ง</button></form>}</section>}
 </>;
}
