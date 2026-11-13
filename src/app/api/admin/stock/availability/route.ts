import {revalidatePath} from 'next/cache';
import {admin,sameOrigin} from '@/lib/auth';
import {stockEditors} from '@/lib/accounts';
import {saveStockSaleAvailability,stockSaleAvailabilityInput} from '@/lib/stock-sale-availability';
export async function POST(request:Request){
 let actor:string;try{actor=await admin(stockEditors);await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์เปลี่ยนสถานะสินค้า'},{status:403});}
 try{
  const body=await request.text();if(body.length>4000)return Response.json({error:'ข้อมูลมากเกินไป'},{status:413});
  let value:unknown;try{value=JSON.parse(body);}catch{return Response.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});}
  const input=stockSaleAvailabilityInput.safeParse(value);if(!input.success)return Response.json({error:'ตรวจรหัสสินค้าและสถานะอีกครั้ง'},{status:400});
  const result=await saveStockSaleAvailability(actor,input.data);
  revalidatePath('/admin/stock');revalidatePath('/customer');
  return Response.json({ok:true,...result});
 }catch(error){
  const code=error instanceof Error?error.message:'';
  const message=code==='STOCK_AVAILABILITY_CHANGED'?'สถานะถูกเปลี่ยนแล้ว กรุณารีเฟรชก่อนลองใหม่':code==='STOCK_PRODUCT_NOT_FOUND'?'ไม่พบสินค้านี้ในสต๊อก':'บันทึกสถานะไม่ได้ กรุณาลองใหม่';
  return Response.json({error:message},{status:['STOCK_AVAILABILITY_CHANGED','STOCK_PRODUCT_NOT_FOUND'].includes(code)?409:503});
 }
}
