import {crmDate,crmMoney,type summarizeCustomerOrders} from '@/lib/customer-crm';

type History=ReturnType<typeof summarizeCustomerOrders>['allHistory'];

export function CustomerOrderHistory({history,title='ออเดอร์ของฉัน',emptyText='ยังไม่มีออเดอร์'}:{history:History;title?:string;emptyText?:string}){
 return <section className="portal-section">
  <div className="portal-section-title"><h2>{title}</h2><span>{history.length} รายการ</span></div>
  {history.length?<div className="portal-orders">{history.map(row=><article key={row.order.id} className="portal-order">
   <header><strong>{row.order.orderNumber}</strong><span className="portal-status">{row.status}</span></header>
   <div className="portal-order-meta"><span>{crmDate(row.order.eventAt)} · {row.order.payment}</span><strong>{row.amountSatang!==null?crmMoney(row.amountSatang):'รอยืนยันยอด'}</strong></div>
   <div className="portal-tracking"><span>เลขพัสดุ</span><strong>{row.tracking??'รอจัดส่ง'}</strong></div>
  </article>)}</div>:<div className="portal-empty">{emptyText}<br/><small>แจ้งรหัสลูกค้านี้กับพนักงานเมื่อสั่งซื้อ เพื่อให้แสดงออเดอร์ที่นี่</small></div>}
 </section>;
}
