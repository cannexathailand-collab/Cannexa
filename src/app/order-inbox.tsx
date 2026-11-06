import {OrderCard} from './order-card';
import type {loadOrderInbox} from '@/lib/order-inbox';
export function OrderInbox({data,fromList=false}:{data:Awaited<ReturnType<typeof loadOrderInbox>>;fromList?:boolean}){
 return <>{!data.orders.length&&<p className="empty">ยังไม่มีข้อความออเดอร์ที่รับไว้</p>}{data.orders.map(o=>{const shipment=data.shipmentByOrder.get(o.id);return <OrderCard key={o.id} order={o} sale={data.saleByOrder.get(o.id)} sellerName={data.sellerLabel(o.affiliateId,o.sellerCode)} groupName={data.groupNames.get(o.groupKey)} tracking={shipment?.tracking} fulfillmentStatus={shipment?.fulfillmentStatus} dispatchedAt={shipment?.dispatchedAt} reviewHref={'/admin/orders/'+encodeURIComponent(o.id)+'/review'+(fromList?'?from=list':'')}/>;})}</>;
}
