import {z} from 'zod';
import {canonicalCustomerCode} from './customer-code';
import {transaction,userLock} from './db';
import type {Prisma} from '@prisma/client';

export const activeCustomerProfileFilter:Prisma.CustomerWhereInput={
 NOT:{profileResetAt:{not:null},portalProfileIncomplete:true},
};
const deletionInput=z.object({code:z.string().trim().min(1).max(30),requestKey:z.uuid()});

export async function deleteCustomerProfile(actor:string,input:unknown){
 const parsed=deletionInput.safeParse(input);
 if(!parsed.success)throw Error('INVALID_CUSTOMER_DELETE');
 const code=canonicalCustomerCode(parsed.data.code),requestKey=parsed.data.requestKey;
 return transaction(async tx=>{
  await userLock(tx,'website-order:'+code);
  await userLock(tx,'customer-profile:'+code);
  const previous=await tx.auditLog.findFirst({where:{action:'CUSTOMER_PROFILE_DELETED',entityId:code,details:{path:['requestKey'],equals:requestKey}},select:{id:true}});
  if(previous)return {code};
  const customer=await tx.customer.findUnique({where:{code},select:{code:true,lineUserKey:true}});
  if(!customer)throw Error('CUSTOMER_NOT_FOUND');
  await tx.customerAccessLink.deleteMany({where:{customerCode:code}});
  await tx.customerDeliveryAddress.deleteMany({where:{customerCode:code}});
  if(customer.lineUserKey)await tx.lineMessageRecipient.deleteMany({where:{lineUserKey:customer.lineUserKey}});
  await tx.customer.update({where:{code},data:{
   title:null,name:null,phone:null,address:null,identityKey:null,
   portalUsername:null,portalPasswordSalt:null,portalPasswordHash:null,
   discoverySource:null,registrationPhone:null,registeredAt:null,referrerId:null,metaFbc:null,
   portalRegistrationPending:true,portalProfileIncomplete:true,profileResetAt:new Date(),
  }});
  await tx.auditLog.create({data:{actor,action:'CUSTOMER_PROFILE_DELETED',entityId:code,details:{requestKey}}});
  return {code};
 });
}

export async function customerProfileDeletionResponse(request:Request,actor:string){
 let input:unknown;
 try{const text=await request.text();if(text.length>2000)throw Error();input=JSON.parse(text);}
 catch{return Response.json({error:'ข้อมูลคำขอลบไม่ถูกต้อง'},{status:400});}
 try{return Response.json({ok:true,...await deleteCustomerProfile(actor,input)});}
 catch(error){
  const message=error instanceof Error?error.message:'';
  if(message==='CUSTOMER_NOT_FOUND')return Response.json({error:'ไม่พบลูกค้า'},{status:404});
  if(message==='INVALID_CUSTOMER_DELETE')return Response.json({error:'ข้อมูลคำขอลบไม่ถูกต้อง'},{status:400});
  return Response.json({error:'ลบข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:503});
 }
}
