import {after} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {changeOrder} from '@/lib/order-changes';
import {syncStockReservation} from '@/lib/stock-flow';
export const maxDuration=60;
export async function POST(request:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์แก้ไขออเดอร์'},{status:403});}
 try{
  const text=await request.text();if(text.length>20000)throw Error('ข้อมูลมากเกินไป');
  const result=await changeOrder(actor,JSON.parse(text));
  after(async()=>{await syncStockReservation(result.id,actor).catch(()=>{});});
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'บันทึกไม่สำเร็จ กรุณาลองใหม่'},{status:400});}
}
