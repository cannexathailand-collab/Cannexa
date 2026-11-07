import {NextRequest,NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {saveCrmPointRule} from '@/lib/crm-point-settings';
import {moneySatang} from '@/lib/shipment-matching';
import {baseUrl} from '@/lib/config';
import {pointTierKeys,tierPointRatesSchema} from '@/lib/crm-tier-points';
export async function POST(req:NextRequest){
 try{
  const actor=await admin(approvers);await sameOrigin();const form=await req.formData();
  const enabled=form.get('enabled')==='on';
  if(form.get('mode')==='tier'){
   const rates=tierPointRatesSchema.parse(Object.fromEntries(pointTierKeys.map(key=>[key,Number(form.get('points_'+key))])));
   if(pointTierKeys.some(key=>form.get('points_'+key)===null||form.get('points_'+key)===''))throw Error('INVALID_RATE');
   await saveCrmPointRule(actor,enabled,100000,rates);
  }else{
   const satangPerPoint=moneySatang(String(form.get('bahtPerPoint')??''));if(!satangPerPoint)throw Error('INVALID_RATE');
   await saveCrmPointRule(actor,enabled,satangPerPoint);
  }
  return NextResponse.redirect(baseUrl()+'/admin/crm/points?saved=1',303);
 }catch(error){const message=error instanceof Error?error.message:'';return new Response('ไม่สามารถบันทึกได้ กรุณาตรวจสอบสิทธิ์และจำนวนบาทต่อ Green Coin',{status:message==='UNAUTHORIZED'?401:message==='FORBIDDEN'?403:400});}
}
