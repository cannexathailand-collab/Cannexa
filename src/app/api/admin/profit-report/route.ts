import {NextResponse} from 'next/server';
import {admin,sameOrigin,cookieOptions} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {signToken} from '@/lib/crypto';
import {createProfitReportBinding,toggleProfitReport} from '@/lib/owner-profit-report';
export async function POST(request:Request){
 let actor:string;
 try{actor=await admin();await sameOrigin();}catch{return new Response('Forbidden',{status:403})}
 const redirect=(status:string)=>NextResponse.redirect(baseUrl()+'/admin/sales/line-report?status='+status,303);
 try{
  const form=await request.formData();
  if(form.get('action')==='bind'){
   const binding=await createProfitReportBinding(actor);
   const response=redirect('binding');
   response.cookies.set('profit_report_binding',signToken({purpose:'profit-report-binding',actor,code:binding.code,exp:+binding.expiresAt}),{...cookieOptions,maxAge:900});
   return response;
  }
  if(!['enable','disable'].includes(String(form.get('action'))))return redirect('error');
  await toggleProfitReport(actor,form.get('action')==='enable');
  return redirect('saved');
 }catch{return redirect('error')}
}
