import Link from 'next/link';
import {requireAdminPage} from '@/lib/auth';
import {displayCustomerCode} from '@/lib/customer-code';
import {db} from '@/lib/db';
import {metaAdCode} from '@/lib/meta-ad';
import {listWebsiteOrders} from '@/lib/website-orders';
import {websiteOrderStatusLabels} from '@/lib/website-order-status';
import {WebsiteOrderReviewControls} from './review-controls';

export const dynamic = 'force-dynamic';
const money = (satang: number) => (satang / 100).toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2});

export default async function WebsiteOrdersPage({searchParams}: {searchParams: Promise<{status?: string}>}) {
  await requireAdminPage();
  const params = await searchParams;
  const status = params.status === 'ALL' ? undefined : Object.hasOwn(websiteOrderStatusLabels, params.status ?? '') ? params.status : 'PENDING_REVIEW';
  const orders = await listWebsiteOrders(status);
  const pendingCodes = [...new Set(orders.filter(order => order.status === 'PENDING_REVIEW').map(order => order.customerCode))];
  const referrers = pendingCodes.length ? await db.customer.findMany({where: {code: {in: pendingCodes}}, select: {code: true, referrer: {select: {code: true, active: true, archivedAt: true}}}}) : [];
  const sellerCodes = new Map(referrers.map(row => [row.code, row.referrer && row.referrer.active && !row.referrer.archivedAt && row.referrer.code !== metaAdCode ? row.referrer.code : '']));
  const intakeIds = orders.flatMap(order => order.intakeOrderId ? [order.intakeOrderId] : []);
  const intakes = intakeIds.length ? await db.orderIntake.findMany({where: {id: {in: intakeIds}}, select: {id: true, orderNumber: true}}) : [];
  const intakeNumbers = new Map(intakes.map(row => [row.id, row.orderNumber]));
  return <>
    <div className="intro"><div><div className="eyebrow">ออเดอร์ / เว็บไซต์</div><h1>ออเดอร์จากเว็บไซต์</h1>
      <p className="muted">รายการที่ลูกค้าส่งจากตะกร้า Shop ระหว่างรอตรวจระบบกันสต๊อกไว้ให้ เมื่ออนุมัติจะสร้างออเดอร์จัดส่งและจองสต๊อกตามปกติ</p>
    </div><Link className="button secondary" href="/admin/orders/list">รายการออเดอร์</Link></div>
    <section className="card">
      <form method="get" className="website-order-filter">
        <label>สถานะการตรวจสอบ<select name="status" defaultValue={status ?? 'ALL'}>
          <option value="ALL">ทั้งหมด</option>
          {Object.entries(websiteOrderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label><button>แสดงรายการ</button>
      </form>
      <p className="muted small">แสดง {orders.length} รายการล่าสุด</p>
    </section>
    <div className="website-order-list">
      {orders.map(order => <article className="card website-order-card" id={"website-order-"+order.id} key={order.id} aria-label={'ออเดอร์ ' + order.orderNumber}>
        <header><div><h2>{order.orderNumber}</h2><span className="muted small">{new Date(order.createdAt).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok'})}</span></div>
          <span className="pill">{websiteOrderStatusLabels[order.status] ?? order.status}</span></header>
        <div className="website-order-customer">
          <div><strong>{order.recipient}</strong><p>{displayCustomerCode(order.customerCode)} · {order.phone}</p><p>{order.address}</p></div>
          <strong className="website-order-total">{money(order.totalSatang)} บาท</strong>
        </div>
        {order.paymentMethod && <div className="website-order-customer">
          <p>วิธีชำระเงิน {order.paymentMethod==='TRANSFER'?'โอนเงิน':'เก็บเงินปลายทาง (COD)'}</p>
          <p>ค่าสินค้า {money(order.subtotalSatang)} บาท · ค่าจัดส่ง {money(order.shippingSatang)} บาท · รวมทั้งสิ้น {money(order.totalSatang)} บาท</p>
        </div>}
        {order.bankDetails && <p>บัญชีรับโอน {order.bankDetails.bankName} · {order.bankDetails.accountName} · {order.bankDetails.accountNumber}</p>}
        {order.slipVersion && <p><a className="button secondary" href={'/api/customer/website-orders/'+encodeURIComponent(order.id)+'/slip?v='+order.slipVersion} target="_blank" rel="noopener noreferrer">ดูสลิปโอนเงิน</a></p>}
        <div className="table-wrap"><table><thead><tr><th>สินค้า</th><th>ขนาด</th><th>จำนวน</th><th>ราคาต่อชิ้น</th><th>รวม</th></tr></thead>
          <tbody>{order.items.map(item => <tr key={item.code + '|' + item.pack}>
            <td><strong>{item.code}</strong><div>{item.name}</div></td><td>{item.pack}</td><td>{item.quantity}</td><td>{money(item.unitPriceSatang)}</td><td>{money(item.lineTotalSatang)}</td>
          </tr>)}</tbody></table></div>
        {order.reviewedAt && <p className="muted small">ตรวจสอบโดย {order.reviewedBy} · {new Date(order.reviewedAt).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok'})}</p>}
        {order.intakeOrderId && <p>ออเดอร์จัดส่ง <Link href={'/admin/orders/list/' + encodeURIComponent(order.intakeOrderId)}>{intakeNumbers.get(order.intakeOrderId) ?? 'เปิดรายละเอียด'}</Link></p>}
        {order.reviewNote && <p>หมายเหตุ {order.reviewNote}</p>}
        <WebsiteOrderReviewControls id={order.id} status={order.status} totalSatang={order.totalSatang} sellerCode={sellerCodes.get(order.customerCode) ?? ''}/>
      </article>)}
      {!orders.length && <section className="card"><p className="empty">ไม่มีออเดอร์จากเว็บไซต์ในสถานะนี้</p></section>}
    </div>
  </>;
}
