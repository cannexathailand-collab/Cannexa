import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {reviewWebsiteOrder,WebsiteOrderApprovalError} from '@/lib/website-orders';

export async function POST(request:Request){
 let actor:string;
 try{await sameOrigin();actor=await admin();}catch{return NextResponse.json({error:'ไม่มีสิทธิ์ตรวจออเดอร์จากเว็บไซต์',code:'FORBIDDEN'},{status:403});}
 try{
  const text=await request.text();
  if(text.length>5000)return NextResponse.json({error:'กรุณาตรวจข้อมูลการพิจารณา',code:'INVALID_WEBSITE_ORDER_REVIEW'},{status:400});
  let input:unknown;
  try{input=JSON.parse(text);}catch{return NextResponse.json({error:'กรุณาตรวจข้อมูลการพิจารณา',code:'INVALID_WEBSITE_ORDER_REVIEW'},{status:400});}
  const order=await reviewWebsiteOrder(actor,input);
  return NextResponse.json({ok:true,order},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  if(error instanceof WebsiteOrderApprovalError)return NextResponse.json({error:'ยังอนุมัติเข้าระบบจัดส่งไม่ได้: '+error.reasons.join(' · '),code:'APPROVAL_BLOCKED',reasons:error.reasons},{status:409});
  const code=error instanceof Error?error.message:'';
  const messages:Record<string,string>={INVALID_WEBSITE_ORDER_REVIEW:'กรุณาตรวจข้อมูลการพิจารณา',WEBSITE_ORDER_NOT_FOUND:'ไม่พบออเดอร์นี้',REVIEW_CONFLICT:'ออเดอร์นี้ได้รับการพิจารณาแล้ว กรุณารีเฟรชหน้าจอ'};
  const status=code==='INVALID_WEBSITE_ORDER_REVIEW'?400:code==='WEBSITE_ORDER_NOT_FOUND'?404:code==='REVIEW_CONFLICT'?409:503;
  return NextResponse.json({error:messages[code]??'บันทึกผลการพิจารณาไม่สำเร็จ กรุณาลองอีกครั้ง',code:messages[code]?code:'UNAVAILABLE'},{status});
 }
}
