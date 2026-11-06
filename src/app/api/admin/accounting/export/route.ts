import {approvers} from '@/lib/accounts';
import {admin} from '@/lib/auth';
import {accountingReport} from '@/lib/accounting-report';
import {accountingCsv} from '@/lib/accounting-summary';
import {accountingJournalCsv} from '@/lib/accounting-journal-csv';
export async function GET(req:Request){
 try{await admin(approvers);}catch{return new Response('Unauthorized',{status:401});}
 const p=new URL(req.url).searchParams;
 try{const report=await accountingReport({from:p.get('from')??undefined,to:p.get('to')??undefined,month:p.get('month')??undefined,view:p.get('view')??undefined});const journal=p.get('scope')==='journal';return new Response(journal?accountingJournalCsv(report):accountingCsv(report,report.notices),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${journal?'accounting-journal':'accounting'}-${report.view}-${report.range.from}-${report.range.to}.csv"`,'Cache-Control':'private, no-store'}});}
 catch(e){if(e instanceof Error&&e.message.startsWith('INVALID'))return new Response('เลือกช่วงวันที่ให้ถูกต้องและไม่เกิน 366 วัน',{status:400});throw e;}
}
