import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {cookieOptions,sameOrigin} from '@/lib/auth';
import {canonicalCustomerCode} from '@/lib/customer-code';
import {equal,passwordHash,userKey} from '@/lib/crypto';
import {db} from '@/lib/db';
import {limit} from '@/lib/rate-limit';
import {portalAccessCookie,portalCookie,portalDuration,portalPasswordCookie,portalPasswordToken} from '@/lib/customer-portal';

export async function POST(request:Request){
 try{await sameOrigin();}catch{return NextResponse.json({error:'ไม่อนุญาต'},{status:403});}
 const invalid=()=>NextResponse.json({error:'รหัสลูกค้าหรือรหัสผ่านไม่ถูกต้อง'},{status:401});
 let input;
 try{const text=await request.text();if(text.length>2000)throw Error();input=JSON.parse(text);}catch{return invalid();}
 if(typeof input?.code!=='string'||input.code.length>30||typeof input?.password!=='string'||!input.password||input.password.length>256)return invalid();
 const code=canonicalCustomerCode(input.code);
 const ip=(request.headers.get('x-forwarded-for')?.split(',')[0]??request.headers.get('x-real-ip')??'unknown').trim().slice(0,100);
 const ipAllowed=await limit('customer-sign-in-ip:'+userKey(ip),50);
 const codeAllowed=await limit('customer-sign-in-code:'+userKey(code),10);
 if(!ipAllowed||!codeAllowed)return NextResponse.json({error:'กรุณารอสักครู่แล้วลองใหม่'},{status:429});
 const customer=await db.customer.findUnique({where:{code}});
 const actual=passwordHash(input.password,customer?.portalPasswordSalt??'customer-sign-in-unavailable');
 if(!customer||customer.portalRegistrationPending||!customer.portalPasswordSalt||!customer.portalPasswordHash||!equal(actual,customer.portalPasswordHash))return invalid();
 const jar=await cookies();
 jar.set(portalPasswordCookie,portalPasswordToken(customer),{...cookieOptions,maxAge:portalDuration});
 jar.delete(portalCookie);jar.delete(portalAccessCookie);jar.delete('customer_password_step');
 return NextResponse.json({ok:true});
}
