import {OrderDocumentButtons} from '@/app/order-document-buttons';
import {loadOrderTeamNames} from '@/lib/order-team';
import {PopupDetails} from '@/app/popup-details';
import {OrderShippingDetails} from '@/app/order-shipping-details';
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
  const intakes = intakeIds.length ? await db.orderIntake.findMany({where: {id: {in: intakeIds}}, select: {id: true, orderNumber: true, groupKey: true, sellerUsername: true}}) : [];
  const intakeById=new Map(intakes.map(row=>[row.id,row]));
  const teams=await loadOrderTeamNames(intakes.map(row=>row.groupKey));
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
    <div className="website-order-list employee-order-list store-preparing-list">
      {orders.map(order => <article className="website-order-card employee-order-card" id={"website-order-"+order.id} key={order.id} aria-label={'ออเดอร์ ' + order.orderNumber}>
        <header><div><strong>{order.intakeOrderId?<Link className="employee-order-reference" href={'/admin/orders/list/'+encodeURIComponent(order.intakeOrderId)} title="เปิดออเดอร์จัดส่ง">{order.orderNumber}</Link>:order.orderNumber}</strong><small>สร้าง {new Date(order.createdAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</small></div><span className="pill">{websiteOrderStatusLabels[order.status]??order.status}</span></header>
        <p className="muted small">ลูกค้า {displayCustomerCode(order.customerCode)}</p>
        <OrderShippingDetails teamName={order.intakeOrderId?teams.get(intakeById.get(order.intakeOrderId)?.groupKey??''):'ยังไม่ระบุทีม'} sellerName={order.intakeOrderId?intakeById.get(order.intakeOrderId)?.sellerUsername??null:null} copyDetails={{orderNumber:order.orderNumber,createdAt:new Date(order.createdAt),status:websiteOrderStatusLabels[order.status]??order.status}} data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.paymentMethod==='TRANSFER'?'โอน':order.paymentMethod,amountSatang:order.totalSatang,items:order.items.map(item=>({code:item.code,name:item.name,quantityMilliG:Math.round(item.grams*item.quantity*1000),description:item.pack+' × '+item.quantity}))}}>
          {order.status==='PENDING_REVIEW'&&<PopupDetails className="compact-order-action" summary="ตรวจสอบและรับออเดอร์" title={'ตรวจสอบออเดอร์ '+order.orderNumber}><WebsiteOrderReviewControls id={order.id} status={order.status} totalSatang={order.totalSatang} sellerCode={sellerCodes.get(order.customerCode)??''}/></PopupDetails>}
          <PopupDetails className="compact-order-action" summary="ราคาสินค้า" title="ราคาสินค้าแยกรายการ"><div className="table-wrap"><table><thead><tr><th>สินค้า</th><th>ขนาด</th><th>จำนวน</th><th>ราคาต่อชิ้น</th><th>รวม</th></tr></thead><tbody>{order.items.map(item=><tr key={item.code+'|'+item.pack}><td><strong>{item.code}</strong><div>{item.name}</div></td><td>{item.pack}</td><td>{item.quantity}</td><td>{money(item.unitPriceSatang)}</td><td>{money(item.lineTotalSatang)}</td></tr>)}</tbody></table></div></PopupDetails>
          {order.slipVersion&&<a href={'/api/customer/website-orders/'+encodeURIComponent(order.id)+'/slip?v='+order.slipVersion} target="_blank" rel="noopener noreferrer">ดูสลิปโอนเงิน</a>}
        </OrderShippingDetails>
        <p className="muted small">ค่าสินค้า {money(order.subtotalSatang)} บาท · ค่าจัดส่ง {money(order.shippingSatang)} บาท</p>
        {order.bankDetails&&<p className="muted small">บัญชีรับโอน {order.bankDetails.bankName} · {order.bankDetails.accountName} · {order.bankDetails.accountNumber}</p>}
        {order.reviewedAt&&<p className="muted small">ตรวจสอบโดย {order.reviewedBy} · {new Date(order.reviewedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>}
        {order.intakeOrderId&&<p className="muted small">ออเดอร์จัดส่ง <Link href={'/admin/orders/list/'+encodeURIComponent(order.intakeOrderId)}>{intakeNumbers.get(order.intakeOrderId)??'เปิดรายละเอียด'}</Link></p>}
        {order.intakeOrderId&&<OrderDocumentButtons orderId={order.intakeOrderId}/>}{order.reviewNote&&<p className="muted small">หมายเหตุ {order.reviewNote}</p>}
      </article>)}
      {!orders.length&&<section className="card"><p className="empty">ไม่มีออเดอร์จากเว็บไซต์ในสถานะนี้</p></section>}
    </div>
  </>;
}
