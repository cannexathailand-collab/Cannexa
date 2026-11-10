import {transaction,userLock,withDatabase} from './db';
import {shopDatabase} from './platform-shops';
import {processPendingReservations} from './stock-flow';
import {processPendingStockDispatches} from './stock-dispatch';
import {processPendingStockReturns} from './stock-return';
import {syncStockWorkbook} from './stock-workbook-sync';
import {syncEmployeeStock} from './employee-stock-sync';
import {importGmailReports,matchShipments} from './gmail-reports';
import {sendDueProfitReport} from './owner-profit-report';

export async function runPlatformShopJobs(){
 const selected=await transaction(async tx=>{
  await userLock(tx,'platform-shop-job-cursor');
  const shops=await tx.platformShop.findMany({where:{active:true,schemaName:{not:'public'}},orderBy:{id:'asc'}});
  if(!shops.length)return [];
  const cursor=await tx.platformJobCursor.upsert({where:{id:'background'},create:{id:'background'},update:{}});
  const start=cursor.nextOffset%shops.length,count=Math.min(2,shops.length);
  await tx.platformJobCursor.update({where:{id:'background'},data:{nextOffset:(start+count)%shops.length}});
  return Array.from({length:count},(_,index)=>shops[(start+index)%shops.length]);
 });
 const results=await Promise.all(selected.map(shop=>withDatabase(shopDatabase(shop.schemaName),async()=>{
  const client=shopDatabase(shop.schemaName);
  const [stock,gmail]=await Promise.all([client.stockSheetsConnection.findUnique({where:{id:'active'}}),client.gmailConnection.findUnique({where:{id:'active'}})]);
  const tasks:Promise<unknown>[]=[sendDueProfitReport()];
  if(gmail?.encryptedToken&&(!gmail.lastSyncAt||Date.now()-gmail.lastSyncAt.getTime()>15*60000))tasks.push((async()=>{
   await importGmailReports('shop-background');await matchShipments('shop-background');
  })());
  if(stock)tasks.push((async()=>{
   await processPendingReservations(1);
   await processPendingStockDispatches('shop-background',1);
   await processPendingStockReturns('shop-background',1);
   const updates=await Promise.allSettled([syncEmployeeStock(),...(stock.systemPrimary?[syncStockWorkbook()]:[])]);
   if(updates.some(result=>result.status==='rejected'))throw Error('SHOP_STOCK_SYNC_FAILED');
  })());
  return (await Promise.allSettled(tasks)).every(result=>result.status==='fulfilled');
 },shop.slug)));
 return {checked:results.length,completed:results.filter(Boolean).length};
}
