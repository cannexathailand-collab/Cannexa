import {validContactPhones} from '@/lib/contact-phones';
import {customerCategory} from '@/lib/customer-category';
import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {portalCustomer,hasPortalAccess,savePortalProfile,savePortalPhone} from '@/lib/customer-portal';
import {limit} from '@/lib/rate-limit';
export async function POST(req:Request){
 try{await sameOrigin();}catch{return NextResponse.json({error:'ไม่อนุญาตให้ส่งข้อมูลจากเว็บไซต์อื่น'},{status:403});}
 const {key,customer,method,marketingEntry}=await portalCustomer();if(!method)return NextResponse.json({error:'กรุณาเข้าสู่ระบบอีกครั้ง'},{status:401});
 const completing=!!customer&&(!!customer.profileResetAt&&customer.portalProfileIncomplete||!marketingEntry&&(customer.portalProfileIncomplete||!validContactPhones(customer.phone??'')));
 if(customer?.portalRegistrationPending&&!completing)return NextResponse.json({error:'กำลังรอร้านอนุมัติสมาชิก'},{status:403});
 if(customer&&!completing&&!await hasPortalAccess(key,customer.code))return NextResponse.json({error:'กรุณาเข้าสู่ระบบอีกครั้ง'},{status:401});
 if(!await limit('customer-profile:'+(customer?.code??key),30))return NextResponse.json({error:'กรุณารอสักครู่แล้วลองใหม่'},{status:429});
 let input;try{const text=await req.text();if(text.length>10000)throw Error();input=JSON.parse(text);if(!input||typeof input!=='object')throw Error();}catch{return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});}
 try{
  if(customer&&typeof input.phone==='string'&&!('name' in input)&&!('address' in input)&&!('houseNumber' in input)){
   const category=customerCategory(input.customerCategory??'GENERAL');
   const saved=await savePortalPhone(key,input.phone,method==='password'?customer.code:undefined,input.discoverySource,input.referrerCode,category,input.businessLicenseNumber);
   return NextResponse.json({ok:true,pending:saved.portalRegistrationPending});
  }
  if(typeof input.title!=='string'||!input.title.trim())return NextResponse.json({error:'กรุณากรอกคำนำหน้า'},{status:400});
  const saved=await savePortalProfile(key,input,method==='password'?customer!.code:undefined);
  return NextResponse.json({ok:true,pending:saved.portalRegistrationPending});
 }
 catch(e){const message=e instanceof Error?e.message:'';return NextResponse.json({error:message==='PHONE_MATCH_AMBIGUOUS'?'เบอร์นี้ตรงกับลูกค้าหลายรหัส กรุณาติดต่อร้านเพื่อตรวจสอบ':message==='PHONE_ALREADY_LINKED'?'เบอร์นี้มีบัญชี LINE ผูกอยู่แล้ว กรุณาติดต่อร้าน':message==='PHONE_LINK_REVIEW_REQUIRED'||message==='PHONE_LINK_CHANGED'?'บัญชีนี้ต้องให้ร้านตรวจสอบก่อนผูกข้อมูลเดิม':message==='EXISTING_CUSTOMER'?'พบข้อมูลลูกค้าเดิม กรุณาติดต่อร้านเพื่อรับลิงก์ยืนยันการผูก LINE โดยไม่สร้างรหัสซ้ำ':message.startsWith('กรุณา')?message:'บันทึกไม่สำเร็จ กรุณาลองใหม่'},{status:message==='EXISTING_CUSTOMER'?409:400});}
}
