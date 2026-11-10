import {sendDueProfitReport} from '@/lib/owner-profit-report';
import {processPendingStockDispatches} from '@/lib/stock-dispatch';
import {equal} from '@/lib/crypto';
import {syncEmployeeStock} from '@/lib/employee-stock-sync';
import {syncStockWorkbook} from '@/lib/stock-workbook-sync';
import {runPlatformShopJobs} from '@/lib/platform-shop-jobs';
export const maxDuration=60;
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32||!equal(req.headers.get('authorization')??'','Bearer '+secret))return new Response('Forbidden',{status:403});
 const profitReport=sendDueProfitReport().catch(()=>({status:'failed'}));
 const shops=runPlatformShopJobs().catch(()=>({error:'Shop background processing failed'}));
 try{
  const dispatches=await processPendingStockDispatches('stock-recovery-cron',1).catch(()=>({error:'Stock dispatch retry failed'}));
  const sheetSync=await syncStockWorkbook();
  return Response.json({...await syncEmployeeStock(),sheetSync,dispatches,profitReport:await profitReport,shops:await shops});
 }catch{await Promise.all([profitReport,shops]);return Response.json({error:'Stock sync failed; previous snapshot retained'},{status:503});}
}
