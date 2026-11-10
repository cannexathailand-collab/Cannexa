import {customerUsername} from '@/lib/customer-username';
import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {cookieOptions,sameOrigin} from '@/lib/auth';
import {canonicalCustomerCode} from '@/lib/customer-code';
import {equal,passwordHash,signToken,userKey} from '@/lib/crypto';
import {account} from '@/lib/accounts';
import {ownerEmployeeCookie} from '@/lib/employee-view';
import {customerAgeCookie} from '@/lib/customer-age';
import {db} from '@/lib/db';
import {limit} from '@/lib/rate-limit';
import {portalAccessCookie,portalCookie,portalDuration,portalPasswordCookie,portalPasswordToken} from '@/lib/customer-portal';

export async function POST(request:Request){
 try{await sameOrigin();}catch{return NextResponse.json({error:'ไม่อนุญาต'},{status:403});}
 const invalid=()=>NextResponse.json({error:'รหัสลูกค้าหรือรหัสผ่านไม่ถูกต้อง'},{status:401});
 let input;
 try{const text=await request.text();if(text.length>2000)throw Error();input=JSON.parse(text);}catch{return invalid();}
 if(!input||input.code!==undefined&&typeof input.code!=='string'||typeof input.password!=='string'||!input.password||input.password.length>256)return invalid();
 const identifier=(input.code??'').trim();
 if(identifier.length>64)return invalid();
 const ownerLogin=!identifier||identifier.toLowerCase()==='owner';
 const code=canonicalCustomerCode(ownerLogin?'owner':identifier);
 let username:string|null=null;
 try{username=customerUsername(identifier);}catch{}
 const ip=(request.headers.get('x-forwarded-for')?.split(',')[0]??request.headers.get('x-real-ip')??'unknown').trim().slice(0,100);
 const ipAllowed=await limit('customer-sign-in-ip:'+userKey(ip),50);
 const codeAllowed=await limit('customer-sign-in-code:'+userKey(username??code),10);
 if(!ipAllowed||!codeAllowed)return NextResponse.json({error:'กรุณารอสักครู่แล้วลองใหม่'},{status:429});
 if(ownerLogin){
  const owner=await account('owner');
  if(!owner||owner.role!=='owner')return invalid();
  const actual=passwordHash(input.password,owner.salt);
  if(!owner.active||!equal(actual,owner.hash))return invalid();
  const jar=await cookies();
  jar.set('admin_session',signToken({role:owner.role,username:owner.username,version:owner.version,exp:Date.now()+30*86400000}),{...cookieOptions,maxAge:2592000});
  jar.delete(portalCookie);jar.delete(portalAccessCookie);jar.delete(portalPasswordCookie);jar.delete('customer_password_step');
  jar.delete(customerAgeCookie);
  return NextResponse.json({ok:true,redirect:'/customer'});
 }
 const customer=(code.length<=30?await db.customer.findUnique({where:{code}}):null)??(username?await db.customer.findUnique({where:{portalUsername:username}}):null);
 const actual=passwordHash(input.password,customer?.portalPasswordSalt??'customer-sign-in-unavailable');
 if(!customer||customer.portalRegistrationPending||customer.portalProfileIncomplete||!customer.portalPasswordSalt||!customer.portalPasswordHash||!equal(actual,customer.portalPasswordHash))return invalid();
 const jar=await cookies();
 jar.set(portalPasswordCookie,portalPasswordToken(customer),{...cookieOptions,maxAge:portalDuration});
 jar.delete(portalCookie);jar.delete(portalAccessCookie);jar.delete('customer_password_step');
 jar.delete('admin_session');jar.delete(ownerEmployeeCookie);
 jar.delete(customerAgeCookie);
 return NextResponse.json({ok:true});
}
