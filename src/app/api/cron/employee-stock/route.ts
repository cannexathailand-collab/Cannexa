import {processPendingStockDispatches} from '@/lib/stock-dispatch';
import {equal} from '@/lib/crypto';
import {syncEmployeeStock} from '@/lib/employee-stock-sync';
import {syncStockWorkbook} from '@/lib/stock-workbook-sync';
export const maxDuration=60;
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32||!equal(req.headers.get('authorization')??'','Bearer '+secret))return new Response('Forbidden',{status:403});
 try{
  const dispatches=await processPendingStockDispatches('stock-recovery-cron',1).catch(()=>({error:'Stock dispatch retry failed'}));
  const sheetSync=await syncStockWorkbook();
  return Response.json({...await syncEmployeeStock(),sheetSync,dispatches});
 }catch{return Response.json({error:'Stock sync failed; previous snapshot retained'},{status:503});}
}
