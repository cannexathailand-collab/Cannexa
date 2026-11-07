import {db} from './db';
import {stockSellableQuantity} from './stock-sales-limit';
import {compareStockCodes} from './stock-sort';
import type {StockRow,StockPrice} from './stock-import';
import type {OrderStockItem} from './order-stock-items';
import type {Prisma} from '@prisma/client';

export function employeeStockRows(products:StockRow[],pending:OrderStockItem[]=[]){
 return products.map(p=>({code:p.code,name:p.name,available:stockSellableQuantity(p,pending.filter(item=>item.code===p.code).reduce((n,item)=>n+item.quantityMilliG,0)),remaining:p.remainingQuantity,prices:p.salePrices.map(price=>({pack:price.pack,priceSatang:price.priceSatang}))})).sort((a,b)=>compareStockCodes(a.code,b.code));
}
export async function employeeStock(client:Prisma.TransactionClient=db){
 const snapshot=await client.employeeStockSnapshot.findUnique({where:{id:'active'}});
 return {rows:snapshot?(snapshot.rows as unknown as ReturnType<typeof employeeStockRows>):[],live:false,readAt:snapshot?.fetchedAt??null};
}
