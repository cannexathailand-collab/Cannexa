import {z} from 'zod';
import type {LineMessageRecipient} from '@prisma/client';
import {db,transaction,userLock} from './db';
import {sha} from './crypto';
import {canonicalCustomerCode} from './customer-code';
import {lineSettings} from './line-settings';
import {decryptLineRecipient} from './line-message-recipient';

export type CustomerLineStatus={ready:boolean;label:string;displayName?:string|null};
export function customerLineStatus(key:string|null,recipient:LineMessageRecipient|null,connection:{botId:string;accessToken?:string}|null,now=new Date()):CustomerLineStatus{
 if(!key)return {ready:false,label:'ยังไม่ผูก LINE'};
 if(!recipient)return {ready:false,label:'รออัปเดตข้อมูล LINE'};
 if(!connection?.accessToken||connection.botId!==recipient.botId)return {ready:false,label:'LINE ร้านยังไม่พร้อม'};
 const recentMessage=recipient.lastMessageAt&&+now-+recipient.lastMessageAt<7*86400000&&(!recipient.friendshipAt||recipient.friendFlag!==false||recipient.lastMessageAt>recipient.friendshipAt);
 if(recipient.friendFlag===true||recentMessage)return {ready:true,label:'พร้อมส่งข้อความ'};
 return {ready:false,label:recipient.friendFlag===false?'ยังไม่เพิ่มเพื่อน / บล็อก LINE':'รอยืนยันสถานะ LINE'};
}

export async function loadCustomerLineStatuses(customers:{code:string;lineUserKey:string|null}[]){
 const keys=customers.flatMap(customer=>customer.lineUserKey?[customer.lineUserKey]:[]);
 const [rows,connection]=await Promise.all([db.lineMessageRecipient.findMany({where:{lineUserKey:{in:keys}}}),lineSettings()]);
 const byKey=new Map(rows.map(row=>[row.lineUserKey,row]));
 return new Map(customers.map(customer=>{const recipient=byKey.get(customer.lineUserKey??'')??null;return [customer.code,{...customerLineStatus(customer.lineUserKey,recipient,connection?.settings??null),displayName:recipient?.displayName??null}];}));
}

const messageInput=z.object({code:z.string().trim().min(1).max(30),requestKey:z.uuid(),text:z.string().trim().min(1).max(5000)});

export async function sendCustomerLineMessage(actor:string,input:unknown){
 const parsed=messageInput.safeParse(input);
 if(!parsed.success)throw Error('INVALID_MESSAGE');
 const {requestKey,text}=parsed.data,code=canonicalCustomerCode(parsed.data.code),payloadHash=sha(text);
 const connection=await lineSettings();
 if(!connection?.settings.accessToken)throw Error('LINE_NOT_READY');
 await transaction(async tx=>{
  await userLock(tx,'customer-line-message:'+requestKey);
  const previous=await tx.customerLineMessage.findUnique({where:{id:requestKey}});
  if(previous){
   if(previous.customerCode!==code||previous.payloadHash!==payloadHash||previous.botId!==connection.settings.botId)throw Error('MESSAGE_CHANGED');
   return;
  }
  const customer=await tx.customer.findUnique({where:{code}});
  if(!customer?.lineUserKey)throw Error('LINE_NOT_LINKED');
  await tx.customerLineMessage.create({data:{id:requestKey,customerCode:code,lineUserKey:customer.lineUserKey,botId:connection.settings.botId,payloadHash}});
 });
 return transaction(async tx=>{
  await userLock(tx,'customer-profile:'+code);
  await userLock(tx,'customer-line-message:'+requestKey);
  const message=await tx.customerLineMessage.findUniqueOrThrow({where:{id:requestKey}});
  if(message.status==='ACCEPTED')return {accepted:true};
  if(Date.now()-+message.createdAt>23*3600000)throw Error('MESSAGE_EXPIRED');
  const customer=await tx.customer.findUnique({where:{code}});
  if(!customer||customer.lineUserKey!==message.lineUserKey||customer.profileResetAt&&customer.portalProfileIncomplete)throw Error('LINE_NOT_LINKED');
  const recipient=await tx.lineMessageRecipient.findUnique({where:{lineUserKey:message.lineUserKey}});
  if(!customerLineStatus(customer.lineUserKey,recipient,connection.settings).ready||!recipient)throw Error('LINE_NOT_READY');
  const userId=decryptLineRecipient(recipient.encryptedUserId,recipient.botId,recipient.lineUserKey);
  let response:Response;
  try{
   response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{Authorization:'Bearer '+connection.settings.accessToken,'Content-Type':'application/json','X-Line-Retry-Key':requestKey},body:JSON.stringify({to:userId,messages:[{type:'text',text}]}),signal:AbortSignal.timeout(8000)});
  }catch{
   await tx.customerLineMessage.update({where:{id:requestKey},data:{status:'UNCERTAIN'}});
   return {accepted:false};
  }
  const accepted=response.ok||response.status===409&&!!response.headers.get('x-line-accepted-request-id');
  await tx.customerLineMessage.update({where:{id:requestKey},data:{status:accepted?'ACCEPTED':'FAILED'}});
  if(accepted)await tx.auditLog.create({data:{actor,action:'CUSTOMER_LINE_MESSAGE_ACCEPTED',entityId:code,details:{requestKey}}});
  return {accepted};
 });
}

export async function customerLineMessageResponse(request:Request,actor:string){
 let input:unknown;
 try{const text=await request.text();if(text.length>12000)throw Error();input=JSON.parse(text);}catch{return Response.json({error:'ข้อมูลข้อความไม่ถูกต้อง'},{status:400});}
 try{
  const result=await sendCustomerLineMessage(actor,input);
  return result.accepted?Response.json({ok:true}):Response.json({error:'ยังยืนยันการส่งไม่ได้ กรุณาลองส่งข้อความเดิมอีกครั้ง ระบบจะป้องกันการส่งซ้ำ'},{status:503});
 }catch(error){
  const messages:Record<string,string>={INVALID_MESSAGE:'กรุณากรอกข้อความไม่เกิน 5,000 ตัวอักษร',MESSAGE_CHANGED:'ข้อความเปลี่ยนไป กรุณาเปิดหน้าต่างส่งใหม่',MESSAGE_EXPIRED:'คำขอหมดอายุ กรุณาเปิดหน้าต่างส่งใหม่',LINE_NOT_LINKED:'ลูกค้ายังไม่มีบัญชี LINE ที่พร้อมติดต่อ',LINE_NOT_READY:'ช่องทาง LINE ของลูกค้ายังไม่พร้อมส่งข้อความ'};
  const message=messages[error instanceof Error?error.message:''];
  return Response.json({error:message??'ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:message?400:503});
 }
}
