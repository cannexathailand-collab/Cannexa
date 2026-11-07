import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {resolveRewardRedemption} from '@/lib/crm-rewards';

export async function POST(request:Request){
 let actor:string;
 try{await sameOrigin();actor=await admin(approvers);}catch{return NextResponse.json({error:'ไม่มีสิทธิ์จัดการรายการแลก'},{status:403});}
 try{
  await resolveRewardRedemption(actor,await request.json());
  return NextResponse.json({ok:true});
 }catch(error){
  return NextResponse.json({error:error instanceof Error&&error.message==='REDEMPTION_RESOLVED'?'รายการนี้ดำเนินการแล้ว กรุณารีเฟรช':'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'},{status:409});
 }
}
