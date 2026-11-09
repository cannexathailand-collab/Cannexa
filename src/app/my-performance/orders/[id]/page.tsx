import {OrderShippingDetails} from '@/app/order-shipping-details';
import {loadOrderShippingItems} from '@/lib/order-shipping-items';
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
 const amount=quotedTotal(order.rawText??''),items=(await loadOrderShippingItems([order])).get(id)!;
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
   <p>สถานะ {status}</p>
   {!closed&&order.status!=='RETURNED'&&shipment?.fulfillmentStatus!=='DISPATCHED'&&!shipment?.dispatchedAt&&order.sellerUsername===actor.username&&<CancelOwnOrderButton id={id} version={orderEditVersion(order)} orderNumber={order.orderNumber}/>}
   <OrderCommissionStatus visible={order.sellerUsername===actor.username} payment={order.payment} codReceived={!!receipt&&receipt.amountSatang===shipment?.codSatang} rows={commissions.rows.filter(row=>row.reference===order.orderNumber)}/>
   <OrderShippingDetails data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.payment,amountSatang:amount,items:items.items}} tracking={shipment?.tracking}/>
   <DuplicateOrderNotice matches={duplicates.get(id)??[]} currentOrder={order} baseHref="/my-performance/orders/"/>
  </section>
 </main>;
}
