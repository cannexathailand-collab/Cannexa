import {admin,sameOrigin} from '@/lib/auth';
import {maxRewardImageBytes} from '@/lib/crm-reward-image';
import {saveStockProductImage} from '@/lib/stock-product-image';

export const maxDuration=60;
export async function POST(request:Request){
 let actor:string;
 try{actor=await admin();await sameOrigin();}catch{return Response.json({error:'เฉพาะเจ้าของระบบเท่านั้นที่อัปโหลดรูปสินค้าได้'},{status:403});}
 try{
  const text=await request.text();
  if(Buffer.byteLength(text)>Math.ceil(maxRewardImageBytes/3)*4+4096)return Response.json({error:'รูปภาพต้องมีขนาดไม่เกิน 2 MB'},{status:413});
  const saved=await saveStockProductImage(actor,JSON.parse(text));
  return Response.json({ok:true,imageVersion:saved.imageVersion});
 }catch(error){
  const code=error instanceof Error?error.message:'';
  const messages:Record<string,string>={INVALID_STOCK_IMAGE:'ข้อมูลรูปสินค้าไม่ถูกต้อง กรุณารีเฟรชแล้วลองใหม่',INVALID_REWARD_IMAGE:'เลือกรูป JPG, PNG หรือ WebP ที่เปิดอ่านได้',REWARD_IMAGE_TOO_LARGE:'รูปภาพต้องมีขนาดไม่เกิน 2 MB',STOCK_PRODUCT_NOT_FOUND:'ไม่พบรหัสสินค้านี้ในรายการล่าสุด',STOCK_IMAGE_VERSION_CONFLICT:'รูปสินค้านี้เปลี่ยนแล้ว กรุณารีเฟรชก่อนอัปโหลด',STOCK_BUSY:'กำลังมีรายการแก้ไขสต๊อกอยู่ กรุณารอสักครู่แล้วลองใหม่'};
  const status=code==='REWARD_IMAGE_TOO_LARGE'?413:code==='STOCK_PRODUCT_NOT_FOUND'?404:['STOCK_IMAGE_VERSION_CONFLICT','STOCK_BUSY'].includes(code)?409:['INVALID_STOCK_IMAGE','INVALID_REWARD_IMAGE'].includes(code)||error instanceof SyntaxError?400:503;
  return Response.json({error:messages[code]??'ยังตรวจสอบรายการสินค้าล่าสุดไม่ได้ กรุณาลองใหม่'},{status});
 }
}
