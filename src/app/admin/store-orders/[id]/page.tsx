import Link from 'next/link';
import {notFound} from 'next/navigation';
import {stockOperators} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {db} from '@/lib/db';
import {orderStockItems} from '@/lib/order-stock-items';
export default async function StoreOrder({params}:{params:Promise<{id:string}>}){
 await requireAdminPage(stockOperators);
 const {id}=await params;
 const order=await db.orderIntake.findUnique({where:{id},select:{orderNumber:true,recipient:true,phone:true,address:true,rawText:true,sellerUsername:true,createdAt:true,payment:true}});
 if(!order)notFound();
 const shipment=await db.shipment.findUnique({where:{orderId:id},select:{tracking:true}});
 const items=orderStockItems(order.rawText);
 return <section className="card"><Link href="/admin/store-orders">กลับออเดอร์เตรียมจัดส่ง</Link><h1>{order.orderNumber}</h1><p>ผู้ขาย {order.sellerUsername}</p><p>สร้าง {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p><h2>ข้อมูลจัดส่ง</h2><p>{order.recipient}</p><p>{order.phone}</p><p>{order.address}</p><p>{order.payment} · เลขพัสดุ {shipment?.tracking??'ยังไม่มี'}</p><h2>สินค้าที่ต้องจัด</h2><ul>{items.items.map(item=><li key={item.code}><Link href={'/admin/stock?q='+encodeURIComponent(item.code)}>{item.code}</Link> · {item.quantityMilliG/1000} G</li>)}</ul>{items.issues.map(issue=><p key={issue} className="notice">{issue}</p>)}<Link className="button" href="/admin/orders/upload">อัปโหลดรายการจัดส่ง</Link></section>;
}