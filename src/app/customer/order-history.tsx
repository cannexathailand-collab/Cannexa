import {loadOrderTeamNames} from '@/lib/order-team';
import {OrderShippingDetails} from '@/app/order-shipping-details';
import {orderStockItems} from '@/lib/order-stock-items';
import {crmDate,type summarizeCustomerOrders} from '@/lib/customer-crm';

type History=ReturnType<typeof summarizeCustomerOrders>['allHistory'];

export async function CustomerOrderHistory({history,title='ออเดอร์ของฉัน',emptyText='ยังไม่มีออเดอร์'}:{history:History;title?:string;emptyText?:string}){
 const teams=await loadOrderTeamNames(history.map(row=>row.order.groupKey));
 return <section className="portal-section">
  <div className="portal-section-title"><h2>{title}</h2><span>{history.length} รายการ</span></div>
  {history.length?<div className="portal-orders">{history.map(row=><article key={row.order.id} className="portal-order">
   <header><strong>{row.order.orderNumber}</strong><span className="portal-status">{row.status}</span></header>
   <p className="portal-muted">{crmDate(row.order.eventAt)}</p>
   <OrderShippingDetails teamName={teams.get(row.order.groupKey)} copyDetails={{orderNumber:row.order.orderNumber,createdAt:row.order.createdAt,status:row.status}} data={{recipient:row.order.recipient,phone:row.order.phone,address:row.order.address,payment:row.order.payment,amountSatang:row.amountSatang,items:orderStockItems(row.order.rawText).items}} tracking={row.tracking}/>
  </article>)}</div>:<div className="portal-empty">{emptyText}<br/><small>แจ้งรหัสลูกค้านี้กับพนักงานเมื่อสั่งซื้อ เพื่อให้แสดงออเดอร์ที่นี่</small></div>}
 </section>;
}
