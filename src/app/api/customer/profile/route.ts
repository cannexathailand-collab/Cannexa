import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {portalKey,savePortalProfile} from '@/lib/customer-portal';
import {limit} from '@/lib/rate-limit';
export async function POST(req:Request){
 try{await sameOrigin();}catch{return NextResponse.json({error:'ไม่อนุญาตให้ส่งข้อมูลจากเว็บไซต์อื่น'},{status:403});}
 const key=await portalKey();if(!key)return NextResponse.json({error:'กรุณาเข้าสู่ระบบด้วย LINE อีกครั้ง'},{status:401});
 if(!await limit('customer-profile:'+key,30))return NextResponse.json({error:'กรุณารอสักครู่แล้วลองใหม่'},{status:429});
 let input;try{const text=await req.text();if(text.length>10000)throw Error();input=JSON.parse(text);if(!input||typeof input!=='object')throw Error();}catch{return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});}
 try{await savePortalProfile(key,input);return NextResponse.json({ok:true});}
 catch(e){const message=e instanceof Error?e.message:'';return NextResponse.json({error:message==='EXISTING_CUSTOMER'?'พบข้อมูลลูกค้าเดิม กรุณาติดต่อร้านเพื่อรับลิงก์ยืนยันการผูก LINE โดยไม่สร้างรหัสซ้ำ':message.startsWith('กรุณา')?message:'บันทึกไม่สำเร็จ กรุณาลองใหม่'},{status:message==='EXISTING_CUSTOMER'?409:400});}
}
