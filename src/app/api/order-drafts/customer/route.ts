import {admin,sameOrigin} from '@/lib/auth';
import {orderDraftCustomer} from '@/lib/order-draft-customer';
import {limit} from '@/lib/rate-limit';
import {userKey} from '@/lib/crypto';
export async function POST(req:Request){
 let actor:string;try{actor=await admin(['employee','owner','admin','manager']);await sameOrigin();}catch{return Response.json({error:'กรุณาเข้าสู่ระบบ'},{status:403});}
 try{
  if(!await limit(userKey('draft-customer:'+actor),60))return Response.json({error:'ค้นหาบ่อยเกินไป กรุณารอสักครู่'},{status:429});
  const input=await req.json(),code=typeof input.code==='string'?input.code.trim().toUpperCase():'';
  if(!/^(?:[A-Z]{1,3}\d{4,8}|CUS-\d{8})$/.test(code))return Response.json({error:'กรอกรหัสลูกค้าให้ถูกต้อง'},{status:400});
  const customer=await orderDraftCustomer(code);
  if(!customer)return Response.json({error:'ไม่พบรหัสลูกค้านี้ สามารถกรอกข้อมูลเองได้'},{status:404});
  return Response.json(customer,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'ค้นหาข้อมูลไม่สำเร็จ กรุณาลองใหม่'},{status:503});}
}
