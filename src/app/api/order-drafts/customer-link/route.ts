import {admin,sameOrigin} from '@/lib/auth';
import {db} from '@/lib/db';
import {canonicalCustomerCode} from '@/lib/customer-code';
import {createCustomerAccessLink} from '@/lib/customer-access-link';
import {limit} from '@/lib/rate-limit';
import {userKey} from '@/lib/crypto';

export async function POST(request:Request){
 let actor:string;
 try{actor=await admin(['employee','sales','owner','admin','manager']);await sameOrigin();}catch{return Response.json({error:'กรุณาเข้าสู่ระบบ'},{status:403});}
 try{
  if(!await limit(userKey('draft-customer-link:'+actor),60))return Response.json({error:'ทำรายการบ่อยเกินไป กรุณารอสักครู่'},{status:429});
  const text=await request.text();if(text.length>1000)return Response.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});
  const input=JSON.parse(text);
  if(typeof input.code!=='string'||! /^(?:[A-Z]{1,3}\d{4,8}|CUS-\d{8})$/i.test(input.code.trim())||!['status','create'].includes(input.action))return Response.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});
  const code=canonicalCustomerCode(input.code);
  const customer=await db.customer.findUnique({where:{code},select:{lineUserKey:true,profileResetAt:true,portalProfileIncomplete:true}});
  if(!customer||customer.profileResetAt&&customer.portalProfileIncomplete)return Response.json({error:'ไม่พบลูกค้า'},{status:404});
  if(input.action==='status'||customer.lineUserKey)return Response.json({linked:!!customer.lineUserKey},{headers:{'Cache-Control':'no-store'}});
  return Response.json({linked:false,...await createCustomerAccessLink(code,actor)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  if(error instanceof Error&&error.message==='ALREADY_LINKED')return Response.json({linked:true});
  if(error instanceof SyntaxError)return Response.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});
  return Response.json({error:'ตรวจสอบหรือสร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่'},{status:503});
 }
}
