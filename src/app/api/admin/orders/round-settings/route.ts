import {admin,sameOrigin} from '@/lib/auth';
import {saveOrderRoundSettings} from '@/lib/order-round-settings';
export async function POST(request:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์ตั้งค่าปิดรอบ'},{status:403});}
 try{
  const text=await request.text();if(text.length>1000)throw Error('ข้อมูลไม่ถูกต้อง');
  return Response.json(await saveOrderRoundSettings(actor,JSON.parse(text)),{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'บันทึกไม่ได้ กรุณาลองใหม่'},{status:400});}
}
