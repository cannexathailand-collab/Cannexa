import type {OrderStockItem} from './order-stock-items';

// Website order lines are pack snapshots; stock is held in milligrams like LINE order reservations.
export function websiteOrderStockItems(items:unknown):OrderStockItem[]{
 const quantities=new Map<string,number>();
 for(const item of Array.isArray(items)?items:[]){
  if(!item||typeof item!=='object')continue;
  const {code,grams,quantity}=item as {code?:unknown;grams?:unknown;quantity?:unknown};
  if(typeof code!=='string'||typeof grams!=='number'||typeof quantity!=='number')continue;
  const milli=Math.round(grams*1000)*quantity;
  if(!Number.isSafeInteger(milli)||milli<=0)continue;
  quantities.set(code,(quantities.get(code)??0)+milli);
 }
 return [...quantities].map(([code,quantityMilliG])=>({code,quantityMilliG}));
}
