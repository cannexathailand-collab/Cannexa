import {orderStockItems} from './order-stock-items';

export function rankChatProductSales(orders:{id:string;rawText:string|null}[],metric:'orders'|'grams'){
 const products=new Map<string,{code:string;orders:number;quantityMilliG:number}>();
 let unreadableOrders=0;
 for(const order of new Map(orders.map(row=>[row.id,row])).values()){
  const parsed=orderStockItems(order.rawText);
  if(parsed.issues.length){unreadableOrders++;continue;}
  for(const item of parsed.items){
   const row=products.get(item.code)??{code:item.code,orders:0,quantityMilliG:0};
   row.orders++;row.quantityMilliG+=item.quantityMilliG;products.set(item.code,row);
  }
 }
 const rows=[...products.values()].sort((a,b)=>metric==='orders'?b.orders-a.orders||b.quantityMilliG-a.quantityMilliG||a.code.localeCompare(b.code):b.quantityMilliG-a.quantityMilliG||b.orders-a.orders||a.code.localeCompare(b.code));
 return {rows:rows.map(row=>({code:row.code,orders:row.orders,grams:row.quantityMilliG/1000})),unreadableOrders};
}
