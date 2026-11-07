import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {redeemReward} from '@/lib/crm-rewards';
import {limit} from '@/lib/rate-limit';

export async function POST(request:Request){
 try{await sameOrigin();}catch{return NextResponse.json({error:'ไม่อนุญาต'},{status:403});}
 const {key,customer}=await portalCustomer();
 if(customer?.portalRegistrationPending)return NextResponse.json({error:'กำลังรอร้านอนุมัติสมาชิก'},{status:403});
 if(!key||!customer||!await hasPortalAccess(key,customer.code))return NextResponse.json({error:'กรุณาเข้าสู่ระบบด้วย LINE'},{status:401});
 if(!await limit('customer-reward:'+customer.code,30))return NextResponse.json({error:'กรุณารอสักครู่แล้วลองใหม่'},{status:429});
 try{
  const text=await request.text();
  if(text.length>2000)throw Error('INVALID_REDEMPTION');
  const redemption=await redeemReward(customer.code,JSON.parse(text));
  return NextResponse.json({ok:true,id:redemption.id,rewardName:redemption.rewardName,points:redemption.points,status:redemption.status});
 }catch(error){
  const messages:Record<string,string>={
   INSUFFICIENT_POINTS:'Green Coin ไม่เพียงพอสำหรับแลกของรางวัลนี้',
   REWARD_UNAVAILABLE:'ของรางวัลนี้หมดหรือปิดให้แลกแล้ว',
   REWARD_NOT_FOUND:'ไม่พบของรางวัลนี้',
   REWARD_CHANGED:'ชื่อหรือจำนวนเหรียญที่ใช้แลกเปลี่ยนแล้ว กรุณาปิดหน้าต่างและเลือกรายการใหม่',
   INVALID_DELIVERY:'กรุณากรอกชื่อ เบอร์โทร และที่อยู่จัดส่งในข้อมูลส่วนตัวให้ครบก่อนแลก',
   CUSTOMER_PENDING:'กำลังรอร้านอนุมัติสมาชิก',
   REDEMPTION_CONFLICT:'รายการแลกนี้เปลี่ยนแปลงแล้ว กรุณาปิดหน้าต่างแล้วลองใหม่',
  };
  return NextResponse.json({error:messages[error instanceof Error?error.message:'']??'แลกของรางวัลไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองใหม่'},{status:400});
 }
}
