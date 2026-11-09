import {randomUUID} from 'node:crypto';
import {StockMissingReview} from './stock-missing-review';
import type {StockFormProduct} from '@/lib/stock-form-match';
import Link from 'next/link';
import {db} from '@/lib/db';
export async function StockReservationStatus({catalog,enabled}:{catalog:StockFormProduct[];enabled:boolean}){
 const [pending,counted,reconciling]=await Promise.all([
  db.stockReservation.findMany({where:{status:{in:['QUEUED','RESERVED']}},orderBy:{createdAt:'asc'}}),
  db.stockReservation.count({where:{status:'ALREADY_COUNTED'}}),
  db.stockReservation.count({where:{status:'RECONCILING'}})
 ]);
 const shipments=await db.shipment.findMany({where:{orderId:{in:pending.map(row=>row.orderId)}},select:{orderId:true,tracking:true,fulfillmentStatus:true,dispatchedAt:true}});
 const shipping=new Map(shipments.map(row=>[row.orderId,row]));
 const dispatched=new Set(shipments.filter(row=>row.fulfillmentStatus==='DISPATCHED'&&row.dispatchedAt).map(row=>row.orderId));
 const queued=pending.filter(r=>r.status==='QUEUED');
 const known=new Set(catalog.map(p=>p.code)),groups=new Map<string,{code:string;requestKey:string;orders:{id:string;number:string}[]}>();
 for(const row of queued)for(const item of Array.isArray(row.items)?row.items:[]){const code=(item as any)?.code;if(typeof code!=='string'||known.has(code))continue;let group=groups.get(code);if(!group){group={code,requestKey:randomUUID(),orders:[]};groups.set(code,group);}if(!group.orders.some(o=>o.id===row.orderId))group.orders.push({id:row.orderId,number:row.orderNumber});}
 return <><StockMissingReview missing={[...groups.values()]} catalog={catalog} enabled={enabled}/>
  {reconciling>0&&<section className="card"><p>กำลังกระทบยอด {reconciling} ออเดอร์</p></section>}
  {counted>0&&<section className="card"><p>ออเดอร์ที่นับในยอดจ่ายเดิมแล้ว {counted} รายการ · ยังไม่ใช้สถานะนี้ยืนยันว่าจัดส่งจริงแล้ว</p></section>}
  {!!pending.length&&<section className="card"><h2>ออเดอร์รอตัดสต๊อก {pending.length} รายการ</h2><p>ยังไม่ยืนยันส่ง {pending.length-dispatched.size} รายการ · ยืนยันส่งแล้วรอตัดสต๊อกหรือตรวจสอบ {dispatched.size} รายการ</p><p>รวมในจำนวนรอจ่ายแล้ว {pending.length-queued.length} รายการ · รอจับคู่หรือตรวจสอบ {queued.length} รายการ</p><details><summary>ดูรายการรอตัดสต๊อกทั้งหมด</summary>{pending.map(r=><div className="notice" key={r.orderId}><Link href={'/admin/orders/'+encodeURIComponent(r.orderId)+'/review'}>{r.orderNumber}</Link>{Array.isArray(r.items)&&<p>{r.items.map((i:any)=>i.code+' '+i.quantityMilliG/1000+' G').join(' · ')}</p>}{r.precounted&&<p>รวมอยู่ในยอดจ่ายเดิมแล้ว · จะไม่หักคงเหลือซ้ำ</p>}{r.needsReconciliation&&<p>รอเทียบเลขออเดอร์กับยอดจ่ายเดิม · ยังไม่ตัดคงเหลือซ้ำ</p>}<p>{dispatched.has(r.orderId)?'ยืนยันส่งแล้ว · รอตัดสต๊อกหรือตรวจสอบ':'ยังไม่ยืนยันส่ง'} · {shipping.get(r.orderId)?.tracking??'ยังไม่มีเลขพัสดุ'}</p><p>{r.status==='RESERVED'?'รวมในจำนวนรอจ่ายแล้ว':Array.isArray(r.issues)&&r.issues.length?r.issues.map(String).join(' · '):'รอประมวลผล'}</p></div>)}</details>{!!queued.length&&<form method="post" action="/api/admin/stock/reservations/retry"><button className="secondary">ตรวจรายการรอจ่ายอีกครั้ง</button></form>}</section>}
 </>;
}
