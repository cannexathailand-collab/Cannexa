import {notFound} from 'next/navigation';
import Link from 'next/link';
import {db} from '@/lib/db';
import {requireAdminPage} from '@/lib/auth';
import {OrderCard} from '@/app/order-card';
import {needsTrackingReview,needsCodReceiptReview} from '@/lib/order-tracking-review';
export default async function OrderDetail({params}:{params:Promise<{id:string}>}){
 await requireAdminPage();const {id}=await params,order=await db.orderIntake.findUnique({where:{id}});if(!order)notFound();
 const [sale,shipment,slip]=await Promise.all([db.salesOrder.findUnique({where:{orderId:id}}),db.shipment.findUnique({where:{orderId:id}}),db.orderPaymentSlip.findUnique({where:{orderId:id},select:{version:true}})]);
 const receipt=shipment&&order.payment==='COD'?await db.codReceipt.findUnique({where:{tracking:shipment.tracking}}):null;
 const closed=['CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status);
 return <><div className="intro"><div><div className="eyebrow">ออเดอร์</div><h1>{order.orderNumber}</h1><p className="muted">รายละเอียดและสถานะล่าสุด</p></div><div className="actions"><Link className="button secondary" href="/admin/orders/list">กลับรายการออเดอร์</Link>{!closed&&<Link className="button" href={'/admin/orders/'+encodeURIComponent(id)+'/review?from=list'}>ตรวจสอบ / จัดการพัสดุ</Link>}</div></div>{needsTrackingReview(order,shipment?.tracking)&&<p className="notice">ต้องตรวจสอบ: ยังไม่มีเลขพัสดุเกิน 3 วันนับจากวันที่บันทึกออเดอร์</p>}{needsCodReceiptReview(order,shipment,receipt)&&<p className="notice">ต้องตรวจสอบ: จัดส่ง COD ครบ 10 วันแล้ว ยังจับคู่ยอดรับเงินไม่สำเร็จ</p>}<section className="card"><OrderCard order={order} sale={sale??undefined} tracking={shipment?.tracking} fulfillmentStatus={shipment?.fulfillmentStatus} dispatchedAt={shipment?.dispatchedAt}/></section>{order.status!=='WITHDRAWN'&&<section className="card"><h2>ข้อมูลจัดส่ง</h2><p>ผู้รับ: {order.recipient??'ยังไม่ระบุ'}</p><p>โทรศัพท์: {order.phone??'ยังไม่ระบุ'}</p><p>ที่อยู่: {order.address??'ยังไม่ระบุ'}</p><p>ผู้ขาย: {order.sellerUsername??order.sellerCode??'ยังไม่ระบุ'}</p></section>}{slip&&<section className="card"><h2>หลักฐานการโอนเงิน</h2><a href={'/api/admin/orders/'+encodeURIComponent(id)+'/slip?v='+slip.version} target="_blank" rel="noopener noreferrer"><img src={'/api/admin/orders/'+encodeURIComponent(id)+'/slip?v='+slip.version} alt="สลิปการโอนเงิน" style={{width:160,maxHeight:200,objectFit:'contain'}}/><p>เปิดรูปหลักฐานการโอน</p></a></section>}</>;
}
