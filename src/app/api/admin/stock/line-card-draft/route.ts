import {admin,sameOrigin} from '@/lib/auth';
import {stockEditors} from '@/lib/accounts';
import {prepareLineCardDraft} from '@/lib/line-card-draft';
import {ZodError} from 'zod';
export async function POST(request:Request){
 try{await admin(stockEditors);await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์เตรียมการ์ดสินค้า'},{status:403});}
 try{
  const text=await request.text();if(text.length>10000)return Response.json({error:'เลือกสินค้าได้ไม่เกิน 50 รายการ'},{status:413});
  return Response.json(await prepareLineCardDraft(JSON.parse(text)),{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  const missing=e instanceof Error&&e.message==='PRODUCT_NOT_FOUND';
  return Response.json({error:missing?'มีสินค้าที่ไม่พบในรายการล่าสุด กรุณารีเฟรช':e instanceof ZodError||e instanceof SyntaxError?'ข้อมูลสินค้าไม่ถูกต้อง':'ยังเตรียมข้อมูลไม่ได้ กรุณาลองใหม่'},{status:missing?409:e instanceof ZodError||e instanceof SyntaxError?400:503});
 }
}
