import {NextRequest,NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {baseUrl} from '@/lib/config';
import {moneySatang} from '@/lib/shipment-matching';
import {savePointPromotion} from '@/lib/crm-point-promotions';
export async function POST(req:NextRequest){
 try{
  const actor=await admin(approvers);await sameOrigin();const f=await req.formData();
  await savePointPromotion(actor,{id:f.get('id')||undefined,requestKey:f.get('requestKey'),name:f.get('name'),enabled:f.get('enabled')==='on',from:f.get('from'),to:f.get('to'),minimumSatang:moneySatang(String(f.get('minimumBaht')??'')),bonusType:f.get('bonusType'),bonusValue:Number(f.get('bonusValue'))});
  return NextResponse.redirect(baseUrl()+'/admin/crm/points?promotionSaved=1',303);
 }catch(e){const message=e instanceof Error?e.message:'';return new Response('บันทึกโปรโมชั่นไม่สำเร็จ กรุณาตรวจสอบชื่อ ช่วงวันที่ ยอดขั้นต่ำ และ Green Coin โบนัส',{status:message==='UNAUTHORIZED'?401:message==='FORBIDDEN'?403:400});}
}
