import {NextRequest,NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {transaction} from '@/lib/db';
import {baseUrl} from '@/lib/config';
import {validTierSettings} from '@/lib/crm-tiers';
export async function POST(req:NextRequest){
 try{
  const actor=await admin(approvers);await sameOrigin();const f=await req.formData();
  const settings={vipTopPercent:Number(f.get('vipTopPercent')),goldTopPercent:Number(f.get('goldTopPercent')),silverTopPercent:Number(f.get('silverTopPercent'))};
  if(!validTierSettings(settings))throw Error('INVALID_TIER_THRESHOLDS');
  await transaction(async tx=>{await tx.crmTierSettings.upsert({where:{id:'default'},create:{id:'default',...settings},update:settings});await tx.auditLog.create({data:{actor,action:'CRM_TIERS_UPDATED',entityId:'default',details:settings}});});
  return NextResponse.redirect(baseUrl()+'/admin/crm/tiers?saved=1',303);
 }catch(e){const message=e instanceof Error?e.message:'';return new Response('เกณฑ์ต้องเรียงจาก VIP Platinum ไป Gold และ Silver ระหว่าง 1 ถึง 99',{status:message==='UNAUTHORIZED'?401:message==='FORBIDDEN'?403:400});}
}
