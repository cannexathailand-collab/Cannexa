import {approvers} from '@/lib/accounts';
import {admin} from '@/lib/auth';
import {salesReport} from '@/lib/sales-report';
import {salesCsv} from '@/lib/sales-csv';
export async function GET(req:Request){
 try{await admin(approvers);}catch{return new Response('Unauthorized',{status:401});}
 const params=new URL(req.url).searchParams;
 try{
  const filters={from:params.get('from')??undefined,to:params.get('to')??undefined,month:params.get('month')??undefined,payment:params.get('payment')??undefined,seller:params.get('seller')??undefined,demo:params.get('demo')??undefined};
  const report=await salesReport(filters),demo=filters.demo==='1';
  return new Response(salesCsv(report,demo),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="sales${demo?'-demo':''}-${report.range.from}-${report.range.to}.csv"`,'Cache-Control':'private, no-store'}});
 }catch(error){if(error instanceof Error&&error.message.startsWith('INVALID'))return new Response('ช่วงวันที่ไม่ถูกต้อง',{status:400});throw error;}
}
