import {db} from './db';
import {readStockSheet} from './stock-google';
import {stockSellableQuantity} from './stock-sales-limit';
import {compareStockCodes} from './stock-sort';
import type {StockRow,StockPrice} from './stock-import';
import type {OrderStockItem} from './order-stock-items';
import {pendingStockSaleItems} from './order-stock-admission';

export function employeeStockRows(products:StockRow[],pending:OrderStockItem[]=[]){
 return products.map(p=>({code:p.code,name:p.name,available:stockSellableQuantity(p,pending.filter(item=>item.code===p.code).reduce((n,item)=>n+item.quantityMilliG,0)),remaining:p.remainingQuantity,prices:p.salePrices.map(price=>({pack:price.pack,priceSatang:price.priceSatang}))})).sort((a,b)=>compareStockCodes(a.code,b.code));
}
export async function employeeStock(){
 const connection=await db.stockSheetsConnection.findUnique({where:{id:'active'},select:{id:true}});
 if(connection){try{const source=await readStockSheet();return {rows:employeeStockRows(source.products,await pendingStockSaleItems()),live:true,readAt:source.readAt};}catch{/* Show the imported snapshot with its timestamp when the source is unavailable. */}}
 const products=await db.stockProduct.findMany({select:{code:true,name:true,remainingQuantity:true,issuedQuantity:true,salePrices:true,importedAt:true,sourceRow:true}});
 const rows=employeeStockRows(products.map(p=>({code:p.code,name:p.name,costSatang:null,receivedQuantity:null,remainingQuantity:p.remainingQuantity?.toNumber()??null,issuedQuantity:p.issuedQuantity?.toNumber()??null,salePrices:p.salePrices as StockPrice[],sourceRow:p.sourceRow})));
 return {rows,live:false,readAt:products.length?new Date(Math.min(...products.map(p=>+p.importedAt))):null};
}
