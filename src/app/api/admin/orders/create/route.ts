import {after} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {createManualOrder} from '@/lib/manual-orders';
import {orderRejectionText} from '@/lib/order-validation';
import {processPendingReservations} from '@/lib/stock-flow';

export const maxDuration=60;
export async function POST(request:Request){
 let actor:string;
 try{actor=await admin();await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์สร้างออเดอร์'},{status:403});}
 try{
  if(Number(request.headers.get('content-length')??0)>3*1024*1024)throw Error('ข้อมูลออเดอร์มีขนาดใหญ่เกินไป');
  const text=await request.text();if(text.length>3*1024*1024)throw Error('ข้อมูลออเดอร์มีขนาดใหญ่เกินไป');
  const result=await createManualOrder(actor,JSON.parse(text));
  if('reasons' in result)return Response.json({error:orderRejectionText(result.reasons)},{status:400});
  after(async()=>{await processPendingReservations(2).catch(()=>{});});
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'บันทึกออเดอร์ไม่สำเร็จ'},{status:400});}
}
