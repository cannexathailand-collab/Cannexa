import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {saveReward} from '@/lib/crm-rewards';

export async function POST(request:Request){
 let actor:string;
 try{await sameOrigin();actor=await admin(approvers);}catch{return NextResponse.json({error:'ไม่มีสิทธิ์จัดการของรางวัล'},{status:403});}
 try{
  await saveReward(actor,await request.json());
  return NextResponse.json({ok:true});
 }catch(error){
  const changed=error instanceof Error&&['REWARD_VERSION_REQUIRED','REWARD_VERSION_CONFLICT','REWARD_REQUEST_CONFLICT'].includes(error.message);
  return NextResponse.json({error:changed?'รายการนี้มีการเปลี่ยนแปลงแล้ว กรุณารีเฟรชก่อนแก้ไข':'บันทึกไม่สำเร็จ กรุณาตรวจชื่อ จำนวน Green Coin และจำนวนพร้อมแลก'},{status:changed?409:400});
 }
}
