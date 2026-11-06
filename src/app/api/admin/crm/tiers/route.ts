import {NextRequest,NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {baseUrl} from '@/lib/config';
import {saveTierRule} from '@/lib/crm-tier-settings';
export async function POST(req:NextRequest){
 try{
  const actor=await admin(approvers);await sameOrigin();const f=await req.formData();
  const rule=await saveTierRule(actor,JSON.parse(String(f.get('rule')??'')));
  return NextResponse.redirect(baseUrl()+'/admin/crm/tiers?saved=1&tier='+rule.tier,303);
 }catch(e){const message=e instanceof Error?e.message:'';return new Response('ไม่สามารถบันทึกเกณฑ์ได้ กรุณาตรวจสอบค่าของแต่ละเกณฑ์',{status:message==='UNAUTHORIZED'?401:message==='FORBIDDEN'?403:400});}
}
