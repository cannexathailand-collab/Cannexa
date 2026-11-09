import {employeeCommissions} from '@/lib/employee-commissions';
import {OrderCommissionStatus} from '../../order-commission-status';
import {OrderReviewView} from '@/app/order-review-view';
import {orderReview} from '@/lib/order-review';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {requireEmployeePage} from '@/lib/employee-view';
import {orderEditVersion} from '@/lib/order-changes';
import {CancelOwnOrderButton} from '@/app/cancel-own-order-button';
import {db} from '@/lib/db';
import {quotedTotal} from '@/lib/shipment-matching';
import {orderStockItems} from '@/lib/order-stock-items';
import {loadDuplicateOrderReviews} from '@/lib/order-duplicates';
import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import {EmployeeNav} from '../../employee-nav';

export default async function SharedOrder({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{from?:string;scope?:string}>}){
 const actor=await requireEmployeePage();
 const {id}=await params;
 const filters=await searchParams;
 if(filters.from==='tasks'){
  const data=await orderReview(id,actor.role==='owner'?{role:'owner'}:{role:'employee',username:actor.username,affiliateId:actor.affiliateId});
  if(!data)notFound();
  return <main className="center-page"><section className="customer"><EmployeeNav active="orders"/><OrderReviewView data={data} backHref="/my-performance/tasks" backLabel="กลับงานค้าง"/></section></main>;
 }
 const order=await db.orderIntake.findUnique({
  where:{id},
  select:{id:true,orderNumber:true,recipient:true,phone:true,address:true,payment:true,rawText:true,sellerUsername:true,eventAt:true,createdAt:true,status:true},
 });
 if(!order)notFound();
 const [shipment,duplicates,commissions]=await Promise.all([
  db.shipment.findUnique({where:{orderId:id},select:{tracking:true,fulfillmentStatus:true,dispatchedAt:true,codSatang:true}}),
  loadDuplicateOrderReviews(),
  order.sellerUsername===actor.username&&actor.affiliateId?employeeCommissions(actor.affiliateId):Promise.resolve({rows:[]}),
 ]);
 const receipt=shipment?await db.codReceipt.findUnique({where:{tracking:shipment.tracking},select:{amountSatang:true}}):null;
 const amount=quotedTotal(order.rawText??''),items=orderStockItems(order.rawText);
 const closed=['CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status);
 const status=closed?'ยกเลิก / ปิดรายการ':order.status==='RETURNED'?'ตีกลับ':shipment?.tracking?'มีเลขพัสดุแล้ว':'รอจัดส่ง';
 return <main className="center-page performance-page">
  <section className="customer">
   <h1>รายละเอียดออเดอร์</h1>
   <EmployeeNav active="orders"/>
   <Link href={filters.scope==='mine'?'/my-performance/orders?scope=mine':'/my-performance/orders'}>กลับรายการออเดอร์</Link>
   <h2>{order.orderNumber}</h2>
   <p>ผู้ขาย {order.sellerUsername??'ยังไม่ระบุ'}</p>
   <p>สร้างออเดอร์ {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
   <p>รับออเดอร์ {order.eventAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
   <p>{order.payment} · {amount===null?'รอยอดเงิน':(amount/100).toLocaleString('th-TH',{style:'currency',currency:'THB'})}</p>
   <p>สถานะ {status}</p>
   <p>เลขพัสดุ {shipment?.tracking??'ยังไม่มีเลขพัสดุ'}</p>
   {!closed&&order.status!=='RETURNED'&&shipment?.fulfillmentStatus!=='DISPATCHED'&&!shipment?.dispatchedAt&&order.sellerUsername===actor.username&&<CancelOwnOrderButton id={id} version={orderEditVersion(order)} orderNumber={order.orderNumber}/>}
   <OrderCommissionStatus visible={order.sellerUsername===actor.username} payment={order.payment} codReceived={!!receipt&&receipt.amountSatang===shipment?.codSatang} rows={commissions.rows.filter(row=>row.reference===order.orderNumber)}/>
   <h2>ข้อมูลผู้รับ</h2>
   <p>{order.recipient}</p>
   <p>{order.phone}</p>
   <p>{order.address}</p>
   <h2>สินค้า</h2>
   {items.items.length?<ul>
    {items.items.map(item=><li key={item.code}>{item.code} · {item.quantityMilliG/1000} กรัม</li>)}
   </ul>:<p>อ่านรายการสินค้าไม่ครบ กรุณาตรวจข้อความต้นทาง</p>}
   <DuplicateOrderNotice matches={duplicates.get(id)??[]} currentOrder={order} baseHref="/my-performance/orders/"/>
  </section>
 </main>;
}
