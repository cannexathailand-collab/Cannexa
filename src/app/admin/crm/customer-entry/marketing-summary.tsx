import Link from 'next/link';
import {crmDate,crmMoney} from '@/lib/customer-crm';
import {marketingWindowDays,type marketingReport} from '@/lib/marketing-report';
import {displayCustomerCode} from '@/lib/customer-code';

export function MarketingSummary({report}:{report:Awaited<ReturnType<typeof marketingReport>>}){
 return <section className="card">
  <h2>ผลลัพธ์ลิงก์การตลาด</h2>
  <form method="get" className="crm-toolbar">
   <label>ตั้งแต่<input type="date" name="from" defaultValue={report.range.from} required/></label>
   <label>ถึง<input type="date" name="to" defaultValue={report.range.to} required/></label>
   <button>แสดงผล</button>
  </form>
  <div className="stats">
   <article className="card stat"><span>คลิกลิงก์</span><strong>{report.visits.toLocaleString('th-TH')}</strong></article>
   <article className="card stat"><span>ลูกค้าเข้าหน้าเว็บ</span><strong>{report.customers.toLocaleString('th-TH')}</strong></article>
   <article className="card stat"><span>ออเดอร์ยืนยันยอดขาย</span><strong>{report.orders.length.toLocaleString('th-TH')}</strong></article>
   <article className="card stat"><span>ยอดขายยืนยัน</span><strong>{crmMoney(report.revenueSatang)}</strong></article>
  </div>
  <p className="muted">เชื่อมออเดอร์ที่เกิดหลังลูกค้า LINE Login และเพิ่มเพื่อนสำเร็จ ภายใน {marketingWindowDays} วันนับจากคลิกลิงก์ โดยใช้ครั้งล่าสุดที่เข้าเงื่อนไข ออเดอร์ละหนึ่งครั้ง ยอดขายใช้วันที่ยืนยันจัดส่งและเงื่อนไขเดียวกับหน้ายอดขาย</p>
  <div className="table-wrap"><table><thead><tr><th>ออเดอร์</th><th>รหัสลูกค้า</th><th>เข้าผ่านลิงก์</th><th>ยืนยันยอดขาย</th><th>ยอดขาย</th></tr></thead>
   <tbody>{report.orders.slice(0,50).map(order=><tr key={order.orderId}><td><Link href={'/admin/orders/list/'+encodeURIComponent(order.orderId)}>{order.orderNumber}</Link></td><td><Link href={'/admin/crm/'+encodeURIComponent(order.customerCode)}>{displayCustomerCode(order.customerCode)}</Link></td><td>{crmDate(order.enteredAt)}</td><td>{crmDate(order.recognizedAt)}</td><td>{crmMoney(order.revenueSatang)}</td></tr>)}</tbody>
  </table></div>
  {!report.orders.length&&<p className="muted">ยังไม่มียอดขายจากลิงก์การตลาดในช่วงวันที่นี้</p>}
  {report.orders.length>50&&<p className="muted">แสดง 50 ออเดอร์แรก กรุณาเลือกช่วงวันที่ให้สั้นลงเพื่อดูรายการที่ต้องการ</p>}
 </section>;
}
