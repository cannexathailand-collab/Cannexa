import {currentAccount} from '@/lib/auth';
import {adminChatResponse} from '@/lib/admin-chat-service';
export const maxDuration=60;
export async function POST(request:Request){
 try{return await adminChatResponse(request,await currentAccount());}
 catch{return Response.json({error:'กรุณาเข้าสู่ระบบใหม่'},{status:401});}
}
