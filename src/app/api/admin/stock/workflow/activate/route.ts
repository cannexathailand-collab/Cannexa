import {admin,sameOrigin} from '@/lib/auth';
import {activateStockFlow} from '@/lib/stock-flow';
export const maxDuration=60;
export async function POST(){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์เปิดรอบสต๊อก'},{status:403});}
 try{return Response.json({ok:true,...await activateStockFlow(actor)});}catch{return Response.json({error:'ยังเปิดรอบจำนวนรอจ่ายไม่สำเร็จ กรุณาตรวจข้อมูลและลองใหม่'},{status:409});}
}
