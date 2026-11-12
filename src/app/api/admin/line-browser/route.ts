import {admin,sameOrigin} from '@/lib/auth';
import {db} from '@/lib/db';
import {enqueueOaCommand,startOaLogin} from '@/lib/line-oa-browser';
export async function GET(){
 try{await admin();}catch{return new Response('Forbidden',{status:403});}
 const data=await db.lineOaBrowser.findUnique({where:{id:'active'},select:{account:true,status:true,sessionId:true,sessionExpiresAt:true,heartbeatAt:true}});
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 try{const text=await request.text();if(text.length>5000)throw Error('INVALID_INPUT');const data=JSON.parse(text);
  if(data.action==='start')await startOaLogin(actor);else await enqueueOaCommand(data);
  return Response.json({ok:true});
 }catch{return Response.json({error:'ยังดำเนินการไม่ได้ กรุณาตรวจว่ามีงานค้างหรือเริ่มเชื่อมใหม่'},{status:409});}
}
