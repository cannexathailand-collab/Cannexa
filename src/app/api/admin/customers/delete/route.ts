import {admin,sameOrigin} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {customerProfileDeletionResponse} from '@/lib/customer-profile-deletion';

export async function POST(request:Request){
 try{await sameOrigin();}catch{return Response.json({error:'ไม่อนุญาต'},{status:403});}
 let actor:string;
 try{actor=await admin(approvers);}catch{return Response.json({error:'ไม่อนุญาต'},{status:403});}
 return customerProfileDeletionResponse(request,actor);
}
