import {db} from './db';
import {readStockSheet} from './stock-google';
import {employeeStockRows} from './employee-stock';
import {pendingStockSaleItems} from './order-stock-admission';
export async function syncEmployeeStock(){
 return db.$transaction(async tx=>{
  const lock=await tx.$queryRawUnsafe<{locked:boolean}[]>('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked','employee-stock-snapshot');
  if(!lock[0]?.locked)return {ok:true,busy:true};
  const previous=await tx.employeeStockSnapshot.findUnique({where:{id:'active'}});
  if(previous&&Date.now()-previous.fetchedAt.getTime()<60000)return {ok:true,fresh:true};
  const source=await readStockSheet();const rows=employeeStockRows(source.products,await pendingStockSaleItems());
  await tx.employeeStockSnapshot.upsert({where:{id:'active'},create:{id:'active',rows,fetchedAt:source.readAt},update:{rows,fetchedAt:source.readAt}});
  return {ok:true,count:rows.length};
 },{timeout:55000});
}
