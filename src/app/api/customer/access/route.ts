import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {sameOrigin,cookieOptions} from '@/lib/auth';
import {portalCustomer,portalDuration} from '@/lib/customer-portal';
import {canonicalCustomerCode} from '@/lib/customer-code';
import {signToken} from '@/lib/crypto';
import {limit} from '@/lib/rate-limit';
export async function POST(request:Request){
 try{await sameOrigin();}catch{return NextResponse.json({error:'ไม่อนุญาต'},{status:403});}
 const {key,customer}=await portalCustomer();if(!key)return NextResponse.json({error:'กรุณาเข้าสู่ระบบด้วย LINE'},{status:401});
 if(customer?.portalRegistrationPending)return NextResponse.json({error:'กำลังรอร้านอนุมัติสมาชิก'},{status:403});
 if(!await limit('customer-code:'+key,20))return NextResponse.json({error:'กรุณารอสักครู่แล้วลองใหม่'},{status:429});
 let code:string;try{const input=await request.json();if(typeof input.code!=='string'||input.code.length>30)throw Error();code=canonicalCustomerCode(input.code);}catch{return NextResponse.json({error:'กรุณากรอกรหัสลูกค้า'},{status:400});}
 if(!customer||customer.code!==code)return NextResponse.json({error:'รหัสนี้ยังไม่เชื่อมกับบัญชี LINE ของคุณ กรุณาติดต่อร้านเพื่อยืนยันรหัสลูกค้า'},{status:409});
 (await cookies()).set('customer_password_step',signToken({purpose:'CUSTOMER_PASSWORD_STEP',key,code,exp:Date.now()+600000}),{...cookieOptions,maxAge:Math.min(portalDuration,600)});
 return NextResponse.json({ok:true});
}
