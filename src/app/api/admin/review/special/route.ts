import {NextRequest,NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {recordSpecialCommission} from '@/lib/special-commission';
import {moneySatang} from '@/lib/shipment-matching';
import {baseUrl} from '@/lib/config';
export async function POST(req:NextRequest){
 try{
  const actor=await admin(approvers);await sameOrigin();const f=await req.formData();
  const row=await recordSpecialCommission(actor,{affiliateId:f.get('affiliateId'),requestKey:f.get('requestKey'),amountSatang:moneySatang(String(f.get('amount')??'')),reason:f.get('reason'),day:f.get('day'),confirmed:f.get('confirmed')==='paid'});
  const url=new URL('/admin/reviews',baseUrl());url.searchParams.set('month',row.paidAt.toLocaleDateString('sv-SE',{timeZone:'Asia/Bangkok'}).slice(0,7));url.searchParams.set('specialPaid','1');return NextResponse.redirect(url,303);
 }catch(e){const message=e instanceof Error?e.message:'';return new Response('บันทึกค่าคอมพิเศษไม่สำเร็จ โปรดตรวจสอบจำนวนเงิน วันที่ และการยืนยันจ่ายแล้ว',{status:message==='UNAUTHORIZED'?401:message==='FORBIDDEN'?403:400});}
}
