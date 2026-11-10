import {admin,sameOrigin} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {customerLineMessageResponse} from '@/lib/customer-line-message';

export async function POST(request:Request){
 try{await sameOrigin();}catch{return Response.json({error:'ไม่อนุญาต'},{status:403});}
 let actor:string;
 try{actor=await admin(managers);}catch{return Response.json({error:'ไม่อนุญาต'},{status:403});}
 return customerLineMessageResponse(request,actor);
}
