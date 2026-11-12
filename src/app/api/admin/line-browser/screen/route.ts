import {admin} from '@/lib/auth';
import {db} from '@/lib/db';
import {unsealOaState} from '@/lib/line-oa-browser';
export async function GET(){
 try{await admin();}catch{return new Response('Forbidden',{status:403});}
 const data=await db.lineOaBrowser.findUnique({where:{id:'active'},select:{screenshotData:true,status:true,sessionExpiresAt:true}});
 if(data?.status!=='AWAITING_LOGIN'||!data.screenshotData||!data.sessionExpiresAt||data.sessionExpiresAt<new Date())return new Response('No active login screen',{status:404});
 const payload=unsealOaState(Buffer.from(data.screenshotData).toString('utf8'));
 return new Response(Buffer.from(payload.base64,'base64'),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
