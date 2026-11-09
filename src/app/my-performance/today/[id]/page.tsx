import {notFound} from 'next/navigation';
import Link from 'next/link';
import {requireEmployeePage} from '@/lib/employee-view';
import {db} from '@/lib/db';
import {quotedTotal} from '@/lib/shipment-matching';
import {orderStockItems} from '@/lib/order-stock-items';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import {EmployeeNav} from '../../employee-nav';

export default async function SharedOrder({params}:{params:Promise<{id:string}>}){
 await requireEmployeePage();
 const {id}=await params;
 const order=await db.orderIntake.findUnique({
  where:{id},
  select:{id:true,orderNumber:true,recipient:true,phone:true,address:true,payment:true,rawText:true,sellerUsername:true,eventAt:true,status:true},
 });
 if(!order)notFound();
 const [shipment,duplicates]=await Promise.all([
  db.shipment.findUnique({where:{orderId:id},select:{tracking:true}}),
  loadDuplicateOrderReviews(),
 ]);
 const amount=quotedTotal(order.rawText??''),items=orderStockItems(order.rawText);
 const closed=['CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status);
 const status=closed?'ยกเลิก / ปิดรายการ':order.status==='RETURNED'?'ตีกลับ':shipment?.tracking?'มีเลขพัสดุแล้ว':'รอจัดส่ง';
 return <main className="center-page performance-page">
  <section className="customer">
   <h1>รายละเอียดออเดอร์</h1>
   <EmployeeNav active="today"/>
   <Link href="/my-performance/today">กลับออเดอร์วันนี้</Link>
   <h2>{order.orderNumber}</h2>
   <p>ผู้ขาย {order.sellerUsername??'ยังไม่ระบุ'}</p>
   <p>รับออเดอร์ {order.eventAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
   <p>{order.payment} · {amount===null?'รอยอดเงิน':(amount/100).toLocaleString('th-TH',{style:'currency',currency:'THB'})}</p>
   <p>สถานะ {status}</p>
   <p>เลขพัสดุ {shipment?.tracking??'ยังไม่มีเลขพัสดุ'}</p>
   <h2>ข้อมูลผู้รับ</h2>
   <p>{order.recipient}</p>
   <p>{order.phone}</p>
   <p>{order.address}</p>
   <h2>สินค้า</h2>
   {items.items.length?<ul>
    {items.items.map(item=><li key={item.code}>{item.code} · {item.quantityMilliG/1000} กรัม</li>)}
   </ul>:<p>อ่านรายการสินค้าไม่ครบ กรุณาตรวจข้อความต้นทาง</p>}
   <DuplicateOrderNotice matches={duplicates.get(id)??[]} baseHref="/my-performance/today/"/>
  </section>
 </main>;
}
