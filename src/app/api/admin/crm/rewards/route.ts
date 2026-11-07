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
  const code=error instanceof Error?error.message:'';
  const changed=['REWARD_VERSION_REQUIRED','REWARD_VERSION_CONFLICT','REWARD_REQUEST_CONFLICT'].includes(code);
  const messages:Record<string,string>={
   INVALID_REWARD_IMAGE:'เลือกรูป JPG, PNG หรือ WebP ที่เปิดอ่านได้',
   REWARD_IMAGE_TOO_LARGE:'รูปภาพต้องมีขนาดไม่เกิน 2 MB',
   INVALID_REWARD_EXPIRY:'กรุณาระบุวันสุดท้ายที่แลกได้ให้ถูกต้อง',
  };
  return NextResponse.json({error:changed?'รายการนี้มีการเปลี่ยนแปลงแล้ว กรุณารีเฟรชก่อนแก้ไข':messages[code]??'บันทึกไม่สำเร็จ กรุณาตรวจชื่อ จำนวน Green Coin และจำนวนพร้อมแลก'},{status:changed?409:400});
 }
}
