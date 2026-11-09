import type {summarizeCustomerOrders} from './customer-crm';
import {orderStockItems} from './order-stock-items';

export function customerProductPurchases(history:ReturnType<typeof summarizeCustomerOrders>['allHistory']){
 const products=new Map<string,{orders:number;quantityMilliG:number}>();
 const orders=new Map(history.map(row=>[row.order.id,row]));
 for(const row of orders.values()){
  if(!row.recognized||row.excluded)continue;
  for(const item of orderStockItems(row.order.rawText).items){
   const total=products.get(item.code)??{orders:0,quantityMilliG:0};
   total.orders++;
   total.quantityMilliG+=item.quantityMilliG;
   products.set(item.code,total);
  }
 }
 return products;
}
