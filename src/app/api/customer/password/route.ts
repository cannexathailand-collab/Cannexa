import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {sameOrigin,cookieOptions} from '@/lib/auth';
import {portalCustomer,portalAccessCookie,portalAccessToken,portalDuration,portalPasswordCookie,portalPasswordToken} from '@/lib/customer-portal';
import {readToken,passwordHash,random,equal} from '@/lib/crypto';
import {db} from '@/lib/db';
import {limit} from '@/lib/rate-limit';
export async function POST(request:Request){
 try{await sameOrigin();}catch{return NextResponse.json({error:'ไม่อนุญาต'},{status:403});}
 const {key,customer,method}=await portalCustomer();const jar=await cookies();
 if(customer?.portalRegistrationPending||customer?.portalProfileIncomplete)return NextResponse.json({error:'กำลังรอร้านอนุมัติสมาชิก'},{status:403});
 const step=readToken<{purpose:string;key:string;code:string;exp:number}>(jar.get('customer_password_step')?.value??'');
 if(!method||!customer)return NextResponse.json({error:'กรุณาเข้าสู่ระบบ'},{status:401});
 if(!await limit('customer-password:'+customer.code,10))return NextResponse.json({error:'กรุณารอสักครู่แล้วลองใหม่'},{status:429});
 let input;try{input=await request.json();}catch{return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400});}
 const reset=input?.reset===true;
 if(method==='line'&&!reset&&(step?.purpose!=='CUSTOMER_PASSWORD_STEP'||step.key!==key||step.code!==customer.code||step.exp<=Date.now()))return NextResponse.json({error:'กรุณากรอกรหัสลูกค้าอีกครั้ง'},{status:401});
 if(method==='password'){
  const current=typeof input?.currentPassword==='string'?input.currentPassword:'';
  if(!current||current.length>256||!customer.portalPasswordSalt||!customer.portalPasswordHash||!equal(passwordHash(current,customer.portalPasswordSalt),customer.portalPasswordHash))return NextResponse.json({error:'รหัสผ่านปัจจุบันไม่ถูกต้อง'},{status:403});
 }
 const password=typeof input?.password==='string'?input.password:'';
 if(!password||password.length>256)return NextResponse.json({error:'รหัสผ่านไม่ถูกต้อง'},{status:400});
 let savedCustomer=customer;
 if(method==='line'&&!reset&&customer.portalPasswordHash&&customer.portalPasswordSalt){
  if(!equal(passwordHash(password,customer.portalPasswordSalt),customer.portalPasswordHash))return NextResponse.json({error:'รหัสผ่านไม่ถูกต้อง'},{status:403});
 }else{
  if(password.length<4||input.confirmation!==password)return NextResponse.json({error:'รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร และตรงกับช่องยืนยัน'},{status:400});
  const salt=random(),hash=passwordHash(password,salt);const saved=await db.customer.updateMany({where:{code:customer.code,...(method==='line'?{lineUserKey:key}:{}),portalRegistrationPending:false,portalPasswordHash:customer.portalPasswordHash},data:{portalPasswordSalt:salt,portalPasswordHash:hash}});
  if(saved.count!==1)return NextResponse.json({error:'มีการตั้งรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง'},{status:409});
  savedCustomer={...customer,portalPasswordSalt:salt,portalPasswordHash:hash};
 }
 if(method==='password')jar.set(portalPasswordCookie,portalPasswordToken(savedCustomer),{...cookieOptions,maxAge:portalDuration});
 else{jar.set(portalAccessCookie,portalAccessToken(key!,customer.code),{...cookieOptions,maxAge:portalDuration});jar.delete(portalPasswordCookie);}
 jar.delete('customer_password_step');
 return NextResponse.json({ok:true});
}
