import {customerLanguage} from '@/lib/customer-language-server';
import {db} from '@/lib/db';
import {loadOrderTeamNames} from '@/lib/order-team';
import {OrderShippingDetails} from '@/app/order-shipping-details';
import {loadWebsiteOrdersForCustomer} from '@/lib/website-orders';
import {websiteOrderStatusLabels} from '@/lib/website-order-status';
import {ReceiptButton} from '@/app/receipt-button';

export async function CustomerWebsiteOrders({customerCode}: {customerCode: string}) {
 const {t,language,locale}=await customerLanguage();
  const orders = await loadWebsiteOrdersForCustomer(customerCode);
  const receiptSettings=await db.receiptSettings.findUnique({where:{id:'active'},select:{enabled:true}});
  const ids=orders.flatMap(order=>order.intakeOrderId?[order.intakeOrderId]:[]);
  const invoices=await db.customerTaxInvoice.findMany({where:{orderId:{in:ids}},select:{id:true,orderId:true}});
  const invoiceByOrder=new Map(invoices.map(row=>[row.orderId,row.id]));
  const intakes=ids.length?await db.orderIntake.findMany({where:{id:{in:ids}},select:{id:true,groupKey:true}}):[];
  const intakeById=new Map(intakes.map(row=>[row.id,row]));
  const teams=await loadOrderTeamNames(intakes.map(row=>row.groupKey));
  return <section className="portal-section">
    <div className="portal-section-title"><h2>{t("ออเดอร์จากเว็บไซต์")}</h2><span>{orders.length}{t(" รายการ")}</span></div>
    {orders.length ? <div className="portal-orders">{orders.map(order => <article className="portal-order" key={order.id}>
      <header><strong>{order.orderNumber}</strong><span className="portal-status">{t(websiteOrderStatusLabels[order.status] ?? order.status)}</span></header>
      <div className="portal-order-meta">
        <span>{new Date(order.createdAt).toLocaleString(locale, {timeZone: 'Asia/Bangkok'})}</span>
        <strong>{(order.totalSatang / 100).toLocaleString(locale, {minimumFractionDigits: 2})}{t(" บาท")}</strong>
      </div>
      <OrderShippingDetails slipUrl={order.slipVersion?'/api/customer/website-orders/'+encodeURIComponent(order.id)+'/slip?v='+order.slipVersion:null} documentActions={order.intakeOrderId&&(receiptSettings?.enabled||invoiceByOrder.has(order.intakeOrderId))?<div className="order-document-buttons" aria-label={language==='en'?'Order documents':'เอกสารออเดอร์'}>{receiptSettings?.enabled&&order.intakeOrderId&&<ReceiptButton orderId={order.intakeOrderId} english={language==='en'}/>}{order.intakeOrderId&&invoiceByOrder.has(order.intakeOrderId)&&<a className="button secondary" href={'/tax-invoices/'+invoiceByOrder.get(order.intakeOrderId)}>{language==='en'?'Tax invoice':'ใบกำกับภาษี'}</a>}</div>:undefined} language={language} teamName={order.intakeOrderId?teams.get(intakeById.get(order.intakeOrderId)?.groupKey??''):t('ยังไม่ระบุทีม')} copyDetails={{orderNumber:order.orderNumber,createdAt:new Date(order.createdAt),status:websiteOrderStatusLabels[order.status]??order.status}} data={{recipient:order.recipient,phone:order.phone,address:order.address,payment:order.paymentMethod==='TRANSFER'?'โอน':order.paymentMethod,amountSatang:order.totalSatang,items:order.items.map(item=>({code:item.code,name:item.name,quantityMilliG:Math.round(item.grams*item.quantity*1000),description:item.pack+' × '+item.quantity}))}}/>
      <p className="portal-muted">{t("ค่าสินค้า ")}{(order.subtotalSatang/100).toLocaleString(locale,{minimumFractionDigits:2})}{t(" บาท · ค่าจัดส่ง ")}{(order.shippingSatang/100).toLocaleString(locale,{minimumFractionDigits:2})}{t(" บาท")}</p>
      {order.bankDetails && <p className="portal-muted">{order.bankDetails.bankName} · {order.bankDetails.accountName} · {order.bankDetails.accountNumber}</p>}
      {order.reviewNote && <p className="portal-muted">{t("หมายเหตุจากผู้ตรวจสอบ ")}{order.reviewNote}</p>}
    </article>)}</div> : <p className="portal-empty">{t("ยังไม่มีออเดอร์จากเว็บไซต์")}</p>}
  </section>;
}
