import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {transaction,userLock} from '@/lib/db';
import {canonicalCustomerCode} from '@/lib/customer-code';
export async function POST(request:Request){
 let actor:string;try{await sameOrigin();actor=await admin(managers);}catch{return NextResponse.json({error:'ไม่มีสิทธิ์อนุมัติ'},{status:403});}
 let code:string;try{const input=await request.json();if(typeof input.code!=='string'||input.code.length>30)throw Error();code=canonicalCustomerCode(input.code);}catch{return NextResponse.json({error:'รหัสลูกค้าไม่ถูกต้อง'},{status:400});}
 const approved=await transaction(async tx=>{
  await userLock(tx,'customer-registration:'+code);
  const row=await tx.customer.findUnique({where:{code}});if(!row)return false;
  if(row.portalRegistrationPending){
   await tx.customer.update({where:{code},data:{portalRegistrationPending:false}});
   await tx.auditLog.create({data:{actor,action:'CUSTOMER_REGISTRATION_APPROVED',entityId:code,details:{}}});
  }
  return true;
 });
 return approved?NextResponse.json({ok:true}):NextResponse.json({error:'ไม่พบคำขอสมัคร'},{status:404});
}
