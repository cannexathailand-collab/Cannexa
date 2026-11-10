import {loadOrderTeamNames} from '@/lib/order-team';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {stockOperators} from '@/lib/accounts';
import {requireStockPage} from '@/lib/store-view';
import {db} from '@/lib/db';
import {orderStockItems} from '@/lib/order-stock-items';
import {quotedTotal} from '@/lib/shipment-matching';
import {OrderShippingDetails} from '@/app/order-shipping-details';
export default async function StoreOrder({params}:{params:Promise<{id:string}>}){
 await requireStockPage(stockOperators);
 const {id}=await params;
 const order=await db.orderIntake.findUnique({where:{id},select:{orderNumber:true,groupKey:true,recipient:true,phone:true,address:true,rawText:true,sellerUsername:true,createdAt:true,payment:true}});
 if(!order)notFound();
 const teamName=(await loadOrderTeamNames([order.groupKey])).get(order.groupKey);
 const parsed=orderStockItems(order.rawText);
 const [shipment,sale,products]=await Promise.all([
  db.shipment.findUnique({where:{orderId:id},select:{tracking:true}}),
  db.salesOrder.findUnique({where:{orderId:id},select:{revenueSatang:true}}),
  db.stockProduct.findMany({where:{code:{in:parsed.items.map(item=>item.code)}},select:{code:true,name:true}}),
 ]);
 const names=new Map(products.map(product=>[product.code,product.name]));
 const items=parsed.items.map(item=>({...item,name:names.get(item.code)??null}));
 const amount=quotedTotal(order.rawText??'')??sale?.revenueSatang??null;
 return <section className="card store-shipping-detail">
  <Link href="/admin/store-orders">กลับออเดอร์เตรียมจัดส่ง</Link>
  <header className="intro"><div><h1>{order.orderNumber}</h1><p>สร้าง {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p></div></header>
  <h2>ข้อมูลจัดส่ง</h2><OrderShippingDetails sellerName={order.sellerUsername} teamName={teamName} data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.payment,amountSatang:amount,items}} tracking={shipment?.tracking}/>
  {parsed.issues.map(issue=><p key={issue} className="notice">{issue}</p>)}{parsed.issues.length>0&&<pre>{order.rawText}</pre>}
  <div className="actions"><Link className="button secondary" href={'/admin/store-orders/'+encodeURIComponent(id)+'/review'}>ตรวจสอบสถานะและหลักฐาน</Link><Link className="button" href="/admin/orders/upload">อัปโหลดรายการจัดส่ง</Link></div>
 </section>;
}
