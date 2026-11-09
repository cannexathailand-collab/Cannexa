import {bangkokDay,dayStart,DAY_MS} from './sales-dates';
import type {summarizeCustomerOrders} from './customer-crm';

export const inactiveCustomerLabel='ไม่ได้สั่งซื้อ 3 เดือนขึ้นไป';
export function customerOrderRecency(history:ReturnType<typeof summarizeCustomerOrders>['allHistory'],now=new Date()){
 const orders=history.filter(({order})=>!order.withdrawnAt&&!['CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status)&&['โอน','COD'].includes(order.payment??''));
 const lastOrderAt=orders.reduce<Date|null>((latest,{order})=>!latest||order.eventAt>latest?order.eventAt:latest,null);
 const daysSinceLastOrder=lastOrderAt?Math.max(0,Math.round((+dayStart(bangkokDay(now))-+dayStart(bangkokDay(lastOrderAt)))/DAY_MS)):null;
 return {lastOrderAt,daysSinceLastOrder,inactiveThreeMonths:daysSinceLastOrder!==null&&daysSinceLastOrder>=90};
}
