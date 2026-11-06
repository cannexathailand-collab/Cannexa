import {notFound} from 'next/navigation';
import Link from 'next/link';
import {db} from '@/lib/db';
import {requireAdminPage} from '@/lib/auth';
import {OrderCard} from '@/app/order-card';
export default async function OrderDetail({params}:{params:Promise<{id:string}>}){
 await requireAdminPage();const {id}=await params,order=await db.orderIntake.findUnique({where:{id}});if(!order)notFound();
 const [sale,shipment]=await Promise.all([db.salesOrder.findUnique({where:{orderId:id}}),db.shipment.findUnique({where:{orderId:id}})]);
 const closed=['CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status);
 return <><div className="intro"><div><div className="eyebrow">ออเดอร์</div><h1>{order.orderNumber}</h1><p className="muted">รายละเอียดและสถานะล่าสุด</p></div><div className="actions"><Link className="button secondary" href="/admin/orders/list">กลับรายการออเดอร์</Link>{!closed&&<Link className="button" href={'/admin/orders/'+encodeURIComponent(id)+'/review?from=list'}>ตรวจสอบ / จัดการพัสดุ</Link>}</div></div><section className="card"><OrderCard order={order} sale={sale??undefined} tracking={shipment?.tracking} fulfillmentStatus={shipment?.fulfillmentStatus} dispatchedAt={shipment?.dispatchedAt}/></section>{order.status!=='WITHDRAWN'&&<section className="card"><h2>ข้อมูลจัดส่ง</h2><p>ผู้รับ: {order.recipient??'ยังไม่ระบุ'}</p><p>โทรศัพท์: {order.phone??'ยังไม่ระบุ'}</p><p>ที่อยู่: {order.address??'ยังไม่ระบุ'}</p><p>ผู้ขาย: {order.sellerUsername??order.sellerCode??'ยังไม่ระบุ'}</p></section>}</>;
}
