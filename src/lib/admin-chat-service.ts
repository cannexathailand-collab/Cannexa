import {sameOrigin} from './auth';
import {db} from './db';
import {unsealOpenAiKey} from './openai-connection';
import {chatInput,runAdminChat} from './admin-chat';
import {claimAdminChat,readAdminChatData} from './admin-chat-data';
import type {Role} from './accounts';
export async function adminChatResponse(request:Request,actor:{username:string;role:string},tenant=false){
 try{
  await sameOrigin();
  if(!['owner','admin'].includes(actor.role))return Response.json({error:'บัญชีนี้ไม่มีสิทธิ์ใช้ Chat AI หลังบ้าน'},{status:403});
  const raw=await request.text();if(raw.length>45000)return Response.json({error:'ข้อความยาวเกินไป'},{status:413});
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return Response.json({error:'รูปแบบคำถามไม่ถูกต้อง'},{status:400});}
  const input=chatInput.safeParse(parsed);if(!input.success)return Response.json({error:'กรุณาพิมพ์คำถามไม่เกิน 3,000 ตัวอักษร'},{status:400});
  const connection=await db.openAiConnection.findUnique({where:{id:'active'}});if(!connection)throw Error('OPENAI_NOT_CONFIGURED');
  await claimAdminChat(actor.username);
  const deadline=Date.now()+80000;
  const result=await runAdminChat(input.data,actor.role as Role,{
   model:connection.model,tenant,
   read:(name,args)=>readAdminChatData(actor.role as Role,name,args),
   request:async body=>{
    const remaining=deadline-Date.now();if(remaining<1000)throw Error('CHAT_TIMEOUT');
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+unsealOpenAiKey(connection.encryptedKey),'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(Math.min(remaining,25000)),cache:'no-store'});
    if(!response.ok)throw Error(response.status===429?'CHAT_RATE_LIMIT':'CHAT_AI_FAILED');
    return response.json();
   },
  });
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const code=error instanceof Error?error.message:'';
  const messages:Record<string,string>={UNAUTHORIZED:'กรุณาเข้าสู่ระบบใหม่',BAD_ORIGIN:'คำขอไม่ถูกต้อง',CHAT_FORBIDDEN:'บัญชีนี้ไม่มีสิทธิ์อ่านข้อมูลส่วนนี้',OPENAI_NOT_CONFIGURED:'ร้านนี้ยังไม่ได้เชื่อม AI กรุณาให้เจ้าของร้านตั้งค่าก่อน',CHAT_RATE_LIMIT:'มีคำถามมากเกินไป กรุณารอสักครู่แล้วลองใหม่',CHAT_TIMEOUT:'ใช้เวลาตอบนานเกินไป กรุณาลองถามให้สั้นลง',CHAT_TOO_COMPLEX:'คำถามนี้มีหลายส่วน กรุณาแยกถามทีละเรื่อง',CHAT_INCOMPLETE:'คำตอบยังไม่ครบ กรุณาลองถามใหม่'};
  const status=code==='UNAUTHORIZED'?401:['BAD_ORIGIN','CHAT_FORBIDDEN'].includes(code)?403:code==='CHAT_RATE_LIMIT'?429:503;
  return Response.json({error:messages[code]??'ยังอ่านข้อมูลหรือตอบคำถามไม่ได้ กรุณาลองใหม่ โดยยังไม่มีการแก้ข้อมูลใด ๆ'},{status});
 }
}
