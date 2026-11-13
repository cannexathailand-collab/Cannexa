import {admin,sameOrigin} from '@/lib/auth';
import {stockEditors} from '@/lib/accounts';
import {saveCustomerProductDescription} from '@/lib/customer-product-description';
export async function POST(request:Request){
 let actor:string;try{actor=await admin(stockEditors);await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์แก้ไขคำอธิบายสินค้า'},{status:403});}
 try{
  const body=await request.text();if(body.length>12000)return Response.json({error:'ข้อมูลมากเกินไป'},{status:413});
  return Response.json(await saveCustomerProductDescription(actor,JSON.parse(body)));
 }catch(error){
  const code=error instanceof Error?error.message:'';
  const messages:Record<string,string>={DESCRIPTION_CHANGED:'คำอธิบายถูกแก้ไขแล้ว กรุณารีเฟรชก่อนแก้ไข',PRODUCT_CHANGED:'ข้อมูลสินค้าเปลี่ยนแล้ว กรุณารีเฟรช',PRODUCT_NOT_FOUND:'ไม่พบสินค้านี้ในสต๊อก'};
  return Response.json({error:messages[code]??'ยังบันทึกคำอธิบายสินค้าไม่ได้ กรุณาตรวจข้อความและลองอีกครั้ง'},{status:409});
 }
}
