import {randomUUID} from 'node:crypto';
import {db} from './db';
import {readStockSheet} from './stock-google';
import {stockDeleteFingerprint} from './stock-delete';
import {stockPriceColumns} from './stock-price-columns';
import {stockProductUpdateInput,stockProductUpdatePlan,updateStockProduct} from './stock-product-update';

/** Rename only after the user has selected and approved a reference. */
export async function applySelectedProductName(code:string,previousName:string,name:string,actor:string){
 const source=await readStockSheet(),product=source.products.find(p=>p.code===code);
 if(!product)throw Error('STOCK_PRODUCT_NOT_FOUND');
 if(product.name!==previousName&&product.name!==name)throw Error('STOCK_PRODUCT_CHANGED');
 if(product.name!==name){
  const input=stockProductUpdateInput.parse({requestKey:randomUUID(),code,expectedFingerprint:stockDeleteFingerprint(product,source.tab.title),name,cost:product.costSatang===null?null:product.costSatang/100,quantity:0,prices:stockPriceColumns(source.rows[product.sourceRow-1],source.rows[1]).map(column=>({columnIndex:column.columnIndex,pack:column.pack,price:column.priceSatang===null?null:column.priceSatang/100}))});
  const plan=stockProductUpdatePlan(input,source);
  if(JSON.stringify({...plan.after,name:plan.before.name})!==JSON.stringify(plan.before))throw Error('OA_RENAME_FIELDS_CHANGED');
  await updateStockProduct(input,actor);
 }
 await db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','employee-stock-snapshot');
  const snapshot=await tx.employeeStockSnapshot.findUnique({where:{id:'active'}});
  if(snapshot&&Array.isArray(snapshot.rows))await tx.employeeStockSnapshot.update({where:{id:'active'},data:{rows:snapshot.rows.map(row=>row&&typeof row==='object'&&!Array.isArray(row)&&row.code===code?{...row,name}:row)}});
  await tx.stockProduct.updateMany({where:{code},data:{name}});
 });
}
