import {equal} from '@/lib/crypto';
import {db} from '@/lib/db';
import {readStockSheet} from '@/lib/stock-google';
import {employeeStockRows} from '@/lib/employee-stock';
import {pendingStockSaleItems} from '@/lib/order-stock-admission';
export const maxDuration=60;
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32||!equal(req.headers.get('authorization')??'','Bearer '+secret))return new Response('Forbidden',{status:403});
 try{
  const source=await readStockSheet();
  const rows=employeeStockRows(source.products,await pendingStockSaleItems());
  await db.employeeStockSnapshot.upsert({where:{id:'active'},create:{id:'active',rows,fetchedAt:source.readAt},update:{rows,fetchedAt:source.readAt}});
  return Response.json({ok:true,count:rows.length});
 }catch{return Response.json({error:'Stock sync failed; previous snapshot retained'},{status:503});}
}
