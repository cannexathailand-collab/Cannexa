import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {CustomerRegistrationInputError,registerCustomerByAdmin,setCustomerMembership} from '@/lib/admin-customer-registration';

export async function POST(request:Request){
 let actor:string;
 try{await sameOrigin();actor=await admin(managers);}
 catch{return NextResponse.json({error:'ไม่มีสิทธิ์สร้างสมาชิก'},{status:403});}
 let input:unknown;
 try{
  const text=await request.text();
  if(text.length>12000)throw Error();
  input=JSON.parse(text);
 }catch{return NextResponse.json({error:'กรุณาตรวจสอบข้อมูลลูกค้า'},{status:400});}
 try{
  const result=await registerCustomerByAdmin(input,actor);
  return NextResponse.json(result,{status:result.created?201:409,headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const invalid=error instanceof CustomerRegistrationInputError;
  return NextResponse.json({error:invalid?error.message:'บันทึกสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:invalid?400:503});
 }
}

export async function PATCH(request:Request){
 let actor:string;
 try{await sameOrigin();actor=await admin(managers);}
 catch{return NextResponse.json({error:'ไม่มีสิทธิ์จัดการสมาชิก'},{status:403});}
 let input:unknown;
 try{
  const text=await request.text();
  if(text.length>2000)throw Error();
  input=JSON.parse(text);
 }catch{return NextResponse.json({error:'กรุณาตรวจสอบข้อมูลสมาชิก'},{status:400});}
 try{
  const customer=await setCustomerMembership(input,actor);
  if(!customer)return NextResponse.json({error:'ไม่พบลูกค้า'},{status:404});
  return NextResponse.json({customer},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const invalid=error instanceof CustomerRegistrationInputError;
  return NextResponse.json({error:invalid?error.message:'บันทึกระดับสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:invalid?400:503});
 }
}
