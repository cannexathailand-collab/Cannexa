import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {sameOrigin,cookieOptions} from '@/lib/auth';
import {portalCustomer,portalAccessCookie,portalAccessToken,portalDuration} from '@/lib/customer-portal';
import {readToken,passwordHash,random,equal} from '@/lib/crypto';
import {db} from '@/lib/db';
import {limit} from '@/lib/rate-limit';
export async function POST(request:Request){
 try{await sameOrigin();}catch{return NextResponse.json({error:'ไม่อนุญาต'},{status:403});}
 const {key,customer}=await portalCustomer();const jar=await cookies();
 if(customer?.portalRegistrationPending)return NextResponse.json({error:'กำลังรอร้านอนุมัติสมาชิก'},{status:403});
 const step=readToken<{purpose:string;key:string;code:string;exp:number}>(jar.get('customer_password_step')?.value??'');
 if(!key||!customer||step?.purpose!=='CUSTOMER_PASSWORD_STEP'||step.key!==key||step.code!==customer.code||step.exp<=Date.now())return NextResponse.json({error:'กรุณากรอกรหัสลูกค้าอีกครั้ง'},{status:401});
 if(!await limit('customer-password:'+key,10))return NextResponse.json({error:'กรุณารอสักครู่แล้วลองใหม่'},{status:429});
 let input;try{input=await request.json();}catch{return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});}
 const password=typeof input?.password==='string'?input.password:'';
 if(!password||password.length>256)return NextResponse.json({error:'รหัสผ่านไม่ถูกต้อง'},{status:400});
 if(customer.portalPasswordHash&&customer.portalPasswordSalt){
  if(!equal(passwordHash(password,customer.portalPasswordSalt),customer.portalPasswordHash))return NextResponse.json({error:'รหัสผ่านไม่ถูกต้อง'},{status:403});
 }else{
  if(password.length<4||input.confirmation!==password)return NextResponse.json({error:'รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร และตรงกับช่องยืนยัน'},{status:400});
  const salt=random();const saved=await db.customer.updateMany({where:{code:customer.code,lineUserKey:key,portalPasswordHash:null},data:{portalPasswordSalt:salt,portalPasswordHash:passwordHash(password,salt)}});
  if(saved.count!==1)return NextResponse.json({error:'มีการตั้งรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง'},{status:409});
 }
 jar.set(portalAccessCookie,portalAccessToken(key,customer.code),{...cookieOptions,maxAge:portalDuration});jar.delete('customer_password_step');
 return NextResponse.json({ok:true});
}
