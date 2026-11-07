import {loadWebsiteOrdersForCustomer} from '@/lib/website-orders';
import {websiteOrderStatusLabels} from '@/lib/website-order-status';

export async function CustomerWebsiteOrders({customerCode}: {customerCode: string}) {
  const orders = await loadWebsiteOrdersForCustomer(customerCode);
  return <section className="portal-section">
    <div className="portal-section-title"><h2>ออเดอร์จากเว็บไซต์</h2><span>{orders.length} รายการ</span></div>
    {orders.length ? <div className="portal-orders">{orders.map(order => <article className="portal-order" key={order.id}>
      <header><strong>{order.orderNumber}</strong><span className="portal-status">{websiteOrderStatusLabels[order.status] ?? order.status}</span></header>
      <div className="portal-order-meta">
        <span>{new Date(order.createdAt).toLocaleString('th-TH', {timeZone: 'Asia/Bangkok'})}</span>
        <strong>{(order.totalSatang / 100).toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท</strong>
      </div>
      {order.items.map(item => <p className="website-order-item-summary" key={item.code + '|' + item.pack}>
        {item.name || item.code} · {item.code} · {item.pack} × {item.quantity}
      </p>)}
      {order.reviewNote && <p className="portal-muted">หมายเหตุจากผู้ตรวจสอบ {order.reviewNote}</p>}
    </article>)}</div> : <p className="portal-empty">ยังไม่มีออเดอร์จากเว็บไซต์</p>}
  </section>;
}
