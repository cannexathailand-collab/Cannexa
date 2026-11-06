import Link from 'next/link';
import {db} from '@/lib/db';
export async function StockDispatchStatus(){
 const config=await db.stockIntegrationConfig.findUnique({where:{id:'active'}});
 if(!config?.enabled)return null;
 const rows=await db.stockDispatch.findMany({where:{status:{in:['PENDING','WAITING_COST','NEEDS_REVIEW']}},orderBy:{createdAt:'asc'},take:50});
 return <section className="card"><h2>ต้นทุนสินค้าจากการจัดส่ง</h2><p className="muted">เริ่มเฉพาะออเดอร์ใหม่ตั้งแต่ {config.activeFrom.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})} หลังยืนยันจัดส่งจริง จึงตัดจำนวน G และบันทึกต้นทุนในค่าใช้จ่าย ไม่ดึงออเดอร์เก่าย้อนหลัง</p><p className="muted small">รายการรอต้นทุนเก็บไว้ก่อน ไม่คิดเป็นศูนย์ เมื่อเติมต้นทุนแล้วจะนำรายการเดิมมาคำนวณโดยไม่ซ้ำ ต้นทุนที่บันทึกแล้วคงค่าเดิมแม้ต้นทุนสินค้าเปลี่ยนภายหลัง</p>{rows.length?<><p>รอประมวลผล / ตรวจสอบ {rows.length}{rows.length===50?' รายการแรก':' รายการ'}</p>{rows.map(row=><div key={row.id} className="notice"><Link href={'/admin/orders/'+encodeURIComponent(row.orderId)+'/review'}>{row.orderNumber}</Link> · {row.candidateTracking} · {row.status==='WAITING_COST'?'รอต้นทุน':row.status==='PENDING'?'รอประมวลผล':'รอตรวจสอบ'}<p>{Array.isArray(row.issues)?row.issues.map(String).join(' · '):''}</p>{Array.isArray(row.items)&&<p>{row.items.map((item:any)=>item.code+' '+(item.quantityMilliG/1000)+' G').join(' · ')}</p>}</div>)}</>:<p className="muted">ไม่มีรายการค้างที่ต้องตรวจสอบ</p>}<form action="/api/admin/stock/dispatch/retry" method="post"><button className="secondary">ตรวจต้นทุนและประมวลผลรายการค้าง</button></form></section>;
}
