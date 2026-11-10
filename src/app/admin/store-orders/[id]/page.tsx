import {OrderDocumentButtons} from '@/app/order-document-buttons';
import {loadOrderTeamNames} from '@/lib/order-team';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {stockOperators} from '@/lib/accounts';
import {requireStockPage} from '@/lib/store-view';
import {db} from '@/lib/db';
import {orderStockItems} from '@/lib/order-stock-items';
import {quotedTotal} from '@/lib/shipment-matching';
import {OrderShippingDetails} from '@/app/order-shipping-details';
import {storeOrderQuery, type StoreOrderInput} from '@/lib/store-order-filters';
import {orderShipmentStatus} from '@/lib/order-shipment-status';
export default async function StoreOrder({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<StoreOrderInput>}){
 await requireStockPage(stockOperators);
 const {id}=await params;
 const query=storeOrderQuery(await searchParams);
 const order=await db.orderIntake.findUnique({where:{id},select:{orderNumber:true,groupKey:true,recipient:true,phone:true,address:true,rawText:true,sellerUsername:true,createdAt:true,payment:true,status:true}});
 if(!order)notFound();
 const teamName=(await loadOrderTeamNames([order.groupKey])).get(order.groupKey);
 const parsed=orderStockItems(order.rawText);
 const [shipment,sale,products]=await Promise.all([
  db.shipment.findUnique({where:{orderId:id},select:{tracking:true,fulfillmentStatus:true,dispatchedAt:true,reportAt:true}}),
  db.salesOrder.findUnique({where:{orderId:id},select:{revenueSatang:true}}),
  db.stockProduct.findMany({where:{code:{in:parsed.items.map(item=>item.code)}},select:{code:true,name:true}}),
 ]);
 const names=new Map(products.map(product=>[product.code,product.name]));
 const items=parsed.items.map(item=>({...item,name:names.get(item.code)??null}));
 const amount=quotedTotal(order.rawText??'')??sale?.revenueSatang??null;
 return <section className="card store-shipping-detail">
  <Link href={'/admin/store-orders?'+query}>กลับจัดการออเดอร์</Link>
  <header className="intro"><div><h1>{order.orderNumber}</h1><p>สร้าง {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p></div></header>
  <h2>ข้อมูลจัดส่ง</h2><OrderShippingDetails documentActions={<OrderDocumentButtons orderId={id}/>} sellerName={order.sellerUsername} teamName={teamName} data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.payment,amountSatang:amount,items}} tracking={shipment?.tracking}><Link className="button secondary" href={'/admin/store-orders/'+encodeURIComponent(id)+'/review?'+query}>ตรวจสอบสถานะและหลักฐาน</Link><Link className="button" href="/admin/orders/upload">อัปโหลดรายการจัดส่ง</Link></OrderShippingDetails>
  <p>สถานะ {orderShipmentStatus(order.status,shipment?.tracking,shipment?.fulfillmentStatus,shipment?.dispatchedAt).label}</p>
  {shipment?.dispatchedAt&&<p>วันที่จัดส่ง {shipment.dispatchedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>}
  {parsed.issues.map(issue=><p key={issue} className="notice">{issue}</p>)}{parsed.issues.length>0&&<pre>{order.rawText}</pre>}
 </section>;
}
