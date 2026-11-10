import {customerLanguage} from '@/lib/customer-language-server';
import {loadOrderTeamNames} from '@/lib/order-team';
import {OrderShippingDetails} from '@/app/order-shipping-details';
import {orderStockItems} from '@/lib/order-stock-items';
import {type summarizeCustomerOrders} from '@/lib/customer-crm';
import {ReceiptButton} from '@/app/receipt-button';
import {db} from '@/lib/db';

type History=ReturnType<typeof summarizeCustomerOrders>['allHistory'];

export async function CustomerOrderHistory({history,title='ออเดอร์ของฉัน',emptyText='ยังไม่มีออเดอร์'}:{history:History;title?:string;emptyText?:string}){
 const {t,language,date:customerDate}=await customerLanguage();
 const receiptSettings=await db.receiptSettings.findUnique({where:{id:'active'},select:{enabled:true}});
 const invoices=await db.customerTaxInvoice.findMany({where:{orderId:{in:history.map(row=>row.order.id)}},select:{id:true,orderId:true}});
 const invoiceByOrder=new Map(invoices.map(row=>[row.orderId,row.id]));
 const teams=await loadOrderTeamNames(history.map(row=>row.order.groupKey));
 return <section className="portal-section">
  <div className="portal-section-title"><h2>{t(title)}</h2><span>{history.length}{t(" รายการ")}</span></div>
  {history.length?<div className="portal-orders">{history.map(row=><article key={row.order.id} className="portal-order">
   <header><strong>{row.order.orderNumber}</strong><span className="portal-status">{t(row.status)}</span></header>
   <p className="portal-muted">{customerDate(row.order.eventAt)}</p>
   <OrderShippingDetails language={language} teamName={teams.get(row.order.groupKey)} copyDetails={{orderNumber:row.order.orderNumber,createdAt:row.order.createdAt,status:row.status}} data={{recipient:row.order.recipient,phone:row.order.phone,address:row.order.address,payment:row.order.payment,amountSatang:row.amountSatang,items:orderStockItems(row.order.rawText).items}} tracking={row.tracking}/>
   {invoiceByOrder.has(row.order.id)&&<a className="button secondary" href={'/tax-invoices/'+invoiceByOrder.get(row.order.id)}>{language==='en'?'Tax invoice':'ใบกำกับภาษี'}</a>}
   {receiptSettings?.enabled&&!row.excluded&&<ReceiptButton orderId={row.order.id} english={language==='en'}/>}
  </article>)}</div>:<div className="portal-empty">{t(emptyText)}<br/><small>{t("แจ้งรหัสลูกค้านี้กับพนักงานเมื่อสั่งซื้อ เพื่อให้แสดงออเดอร์ที่นี่")}</small></div>}
 </section>;
}
