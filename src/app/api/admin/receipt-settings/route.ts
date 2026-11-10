import {admin,sameOrigin} from '@/lib/auth';
import {saveReceiptSettingsResponse} from '@/lib/receipt-http';
export async function POST(request:Request){
 let actor:string;
 try{await sameOrigin();actor=await admin();}catch{return Response.json({error:'เฉพาะเจ้าของร้านเท่านั้น'},{status:403});}
 return saveReceiptSettingsResponse(request,actor);
}
