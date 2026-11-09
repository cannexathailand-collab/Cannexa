import {db} from './db';
import {orderStockItems} from './order-stock-items';

export async function loadOrderShippingItems(orders:{id:string;rawText:string|null}[]){
 const parsed=new Map(orders.map(order=>[order.id,orderStockItems(order.rawText)]));
 const codes=[...new Set([...parsed.values()].flatMap(details=>details.items.map(item=>item.code)))];
 const products=codes.length?await db.stockProduct.findMany({where:{code:{in:codes}},select:{code:true,name:true}}):[];
 const names=new Map(products.map(product=>[product.code,product.name]));
 return new Map([...parsed].map(([id,details])=>[id,{...details,items:details.items.map(item=>({...item,name:names.get(item.code)??null}))}]));
}
