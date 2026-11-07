import {equal} from '@/lib/crypto';
import {syncEmployeeStock} from '@/lib/employee-stock-sync';
export const maxDuration=60;
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32||!equal(req.headers.get('authorization')??'','Bearer '+secret))return new Response('Forbidden',{status:403});
 try{
  return Response.json(await syncEmployeeStock());
 }catch{return Response.json({error:'Stock sync failed; previous snapshot retained'},{status:503});}
}
