import Link from 'next/link';
import {notFound} from 'next/navigation';
import {stockOperators} from '@/lib/accounts';
import {requireStockPage} from '@/lib/store-view';
import {db} from '@/lib/db';
import {orderStockItems} from '@/lib/order-stock-items';
import {quotedTotal} from '@/lib/shipment-matching';
import {shippingSummaryText,shippingPaymentLabel,shippingAmountLabel} from '@/lib/order-shipping-summary';
import {CopyOrderShipping} from '@/app/copy-order-shipping';
export default async function StoreOrder({params}:{params:Promise<{id:string}>}){
 await requireStockPage(stockOperators);
 const {id}=await params;
 const order=await db.orderIntake.findUnique({where:{id},select:{orderNumber:true,recipient:true,phone:true,address:true,rawText:true,sellerUsername:true,createdAt:true,payment:true}});
 if(!order)notFound();
 const parsed=orderStockItems(order.rawText);
 const [shipment,sale,products]=await Promise.all([
  db.shipment.findUnique({where:{orderId:id},select:{tracking:true}}),
  db.salesOrder.findUnique({where:{orderId:id},select:{revenueSatang:true}}),
  db.stockProduct.findMany({where:{code:{in:parsed.items.map(item=>item.code)}},select:{code:true,name:true}}),
 ]);
 const names=new Map(products.map(product=>[product.code,product.name]));
 const items=parsed.items.map(item=>({...item,name:names.get(item.code)??null}));
 const amount=quotedTotal(order.rawText??'')??sale?.revenueSatang??null;
 const text=shippingSummaryText({orderNumber:order.orderNumber,recipient:order.recipient,phone:order.phone,address:order.address,payment:order.payment,amountSatang:amount,tracking:shipment?.tracking??null,seller:order.sellerUsername,items});
 return <section className="card store-shipping-detail">
  <Link href="/admin/store-orders">กลับออเดอร์เตรียมจัดส่ง</Link>
  <header className="intro"><div><h1>{order.orderNumber}</h1><p>ผู้ขาย {order.sellerUsername??'ยังไม่ระบุ'} · สร้าง {order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p></div><CopyOrderShipping key={id} text={parsed.issues.length?text+'\n\nข้อความออเดอร์ต้นฉบับ\n'+(order.rawText??''):text}/></header>
  <h2>ข้อมูลจัดส่ง</h2><dl className="store-shipping-facts">
   <div><dt>ชื่อผู้รับ</dt><dd>{order.recipient||'ยังไม่ระบุ'}</dd></div>
   <div><dt>เบอร์โทร</dt><dd>{order.phone||'ยังไม่ระบุ'}</dd></div>
   <div className="shipping-address"><dt>ที่อยู่จัดส่ง</dt><dd>{order.address||'ยังไม่ระบุ'}</dd></div>
   <div><dt>การชำระเงิน</dt><dd>{shippingPaymentLabel(order.payment)}</dd></div>
   <div><dt>ยอดรวม</dt><dd>{shippingAmountLabel(amount)}</dd></div>
   <div><dt>เลขพัสดุ</dt><dd>{shipment?.tracking??'ยังไม่มีเลขพัสดุ'}</dd></div>
  </dl>
  <h2>สินค้าที่ต้องจัด</h2><div className="table-wrap"><table><thead><tr><th>รหัสสินค้า</th><th>สินค้า</th><th>จำนวน (G)</th></tr></thead><tbody>{items.map(item=><tr key={item.code}><td><Link href={'/admin/stock?q='+encodeURIComponent(item.code)}>{item.code}</Link></td><td>{item.name||'ยังไม่ระบุชื่อ'}</td><td>{(item.quantityMilliG/1000).toLocaleString('th-TH',{maximumFractionDigits:3})}</td></tr>)}</tbody></table></div>
  {parsed.issues.map(issue=><p key={issue} className="notice">{issue}</p>)}{parsed.issues.length>0&&<pre>{order.rawText}</pre>}
  <Link className="button" href="/admin/orders/upload">อัปโหลดรายการจัดส่ง</Link>
 </section>;
}
