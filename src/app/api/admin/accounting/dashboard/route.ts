import {approvers} from '@/lib/accounts';
import {admin} from '@/lib/auth';
import {accountingReport} from '@/lib/accounting-report';
import {dashboardData} from '@/lib/accounting-dashboard';
export async function GET(req:Request){
 try{await admin(approvers);}catch{return new Response('Unauthorized',{status:401});}
 const p=new URL(req.url).searchParams;
 try{
  const data=dashboardData(await accountingReport({from:p.get('from')??undefined,to:p.get('to')??undefined,view:p.get('view')??undefined}));
  return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){if(e instanceof Error&&e.message.startsWith('INVALID'))return Response.json({error:'เลือกช่วงวันที่ให้ถูกต้องและไม่เกิน 366 วัน'},{status:400});throw e;}
}
