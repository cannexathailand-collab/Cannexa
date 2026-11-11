import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {createCustomerAccessLink} from '@/lib/customer-access-link';
import {canonicalCustomerCode} from '@/lib/customer-code';
export async function POST(req:Request){
 let actor;try{await sameOrigin();actor=await admin(managers);}catch{return new Response('Forbidden',{status:403});}
 let code;try{const input=await req.json();if(typeof input.code!=='string'||input.code.length>30)throw Error();code=canonicalCustomerCode(input.code);}catch{return new Response('Bad request',{status:400});}
 try{return NextResponse.json(await createCustomerAccessLink(code,actor),{headers:{'Cache-Control':'no-store'}});}
 catch(error){
  if(error instanceof Error&&error.message==='CUSTOMER_NOT_FOUND')return new Response('Not found',{status:404});
  if(error instanceof Error&&error.message==='ALREADY_LINKED')return NextResponse.json({error:'ลูกค้านี้ผูก LINE แล้ว'},{status:409});
  return NextResponse.json({error:'สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่'},{status:503});
 }
}
