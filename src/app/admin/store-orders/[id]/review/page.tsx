import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireStockPage} from '@/lib/store-view';
import {stockOperators} from '@/lib/accounts';
import {orderReview} from '@/lib/order-review';
import {OrderShippingDetails} from '@/app/order-shipping-details';
import {loadOrderShippingItems} from '@/lib/order-shipping-items';
import {quotedTotal} from '@/lib/shipment-matching';
import {storeOrderQuery,type StoreOrderInput} from '@/lib/store-order-filters';

const money=(satang:number)=>(satang/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท';
export default async function StoreOrderReview({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<StoreOrderInput>}){
 await requireStockPage(stockOperators);
 const {id}=await params,data=await orderReview(id,{role:'store'});if(!data)notFound();
 const query=storeOrderQuery(await searchParams);
 const {order,shipment,receipt,reasons,candidates}=data;
 const parsed=(await loadOrderShippingItems([order])).get(order.id)!;
 return <><header className="intro"><div><h1>ตรวจสอบออเดอร์</h1><p>{order.orderNumber} · สำหรับพนักงานสโตร์</p></div><Link className="button secondary" href={'/admin/store-orders?'+query}>กลับจัดการออเดอร์</Link></header>
  <section className="card"><h2>สิ่งที่ต้องตรวจสอบ</h2>{reasons.length?<ul>{reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>:<p>ไม่พบเงื่อนไขค้างตรวจจากข้อมูลปัจจุบัน</p>}<p>ตรวจข้อมูลผู้รับ เลขพัสดุ และรายงานจากขนส่ง เมื่อหลักฐานเข้าระบบครบ สถานะค้างจะอัปเดตอัตโนมัติ</p></section>
  <section className="card"><h2>ข้อมูลออเดอร์</h2><OrderShippingDetails orderId={order.id} sellerName={order.sellerUsername} data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.payment,amountSatang:quotedTotal(order.rawText??''),items:parsed.items}} tracking={shipment?.tracking}/></section>
  <section className="card"><h2>หลักฐานจัดส่งและรับเงิน</h2>{shipment?<><p>เลขพัสดุ {shipment.tracking}</p><p>{shipment.fulfillmentStatus==='DISPATCHED'&&shipment.dispatchedAt?'วันที่จัดส่ง '+shipment.dispatchedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่มีการยืนยันจัดส่งจริง'}</p><p>{shipment.dispatchEvidence||'ยังไม่มีหลักฐานจัดส่ง'}</p>{order.payment==='COD'&&<><p>ยอด COD ตามพัสดุ {money(shipment.codSatang)}</p><p>ยอดรับเงิน {receipt?money(receipt.amountSatang):'ยังไม่พบรายงานรับเงิน'}</p></>}</>:<p>ยังไม่มีพัสดุที่ผูกกับออเดอร์นี้</p>}<Link className="button" href="/admin/orders/upload">ตรวจและอัปโหลดรายการจัดส่ง</Link></section>
  {candidates.length>0&&<section className="card"><h2>พัสดุที่อาจเกี่ยวข้อง</h2>{candidates.map(candidate=><article key={candidate.tracking}><h3>{candidate.tracking}</h3><p>{candidate.recipient} · {candidate.phone}</p><p>{candidate.address}</p><p>{candidate.orderId?'ผูกกับออเดอร์แล้ว':'ยังไม่ผูกออเดอร์'}</p></article>)}</section>}
 </>;
}
