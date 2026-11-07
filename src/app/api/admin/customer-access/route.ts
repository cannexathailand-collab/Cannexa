import {NextResponse} from 'next/server';
import {admin,sameOrigin} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {db,transaction,userLock} from '@/lib/db';
import {baseUrl} from '@/lib/config';
import {random,sha} from '@/lib/crypto';
import {canonicalCustomerCode} from '@/lib/customer-code';
export async function POST(req:Request){
 let actor;try{await sameOrigin();actor=await admin(managers);}catch{return new Response('Forbidden',{status:403});}
 let code;try{const input=await req.json();if(typeof input.code!=='string'||input.code.length>30)throw Error();code=canonicalCustomerCode(input.code);}catch{return new Response('Bad request',{status:400});}
 const customer=await db.customer.findUnique({where:{code}});if(!customer)return new Response('Not found',{status:404});
 if(customer.lineUserKey)return NextResponse.json({error:'ลูกค้านี้ผูก LINE แล้ว'},{status:409});
 const token=random();
 await transaction(async tx=>{
  await userLock(tx,'customer-access:'+code);
  await tx.customerAccessLink.deleteMany({where:{customerCode:code,usedAt:null}});
  await tx.customerAccessLink.create({data:{tokenHash:sha(token),customerCode:code,createdBy:actor,expiresAt:new Date(Date.now()+86400000)}});
  await tx.auditLog.create({data:{actor,action:'CUSTOMER_ACCESS_LINK_CREATED',entityId:code,details:{}}});
 });
 return NextResponse.json({url:baseUrl()+'/customer?link='+encodeURIComponent(token)},{headers:{'Cache-Control':'no-store'}});
}
