import {sameOrigin} from '@/lib/auth';
import {withShopMutation} from '@/lib/shop-workspace';
import {customerProfileDeletionResponse} from '@/lib/customer-profile-deletion';

export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 try{await sameOrigin();}catch{return Response.json({error:'ไม่อนุญาต'},{status:403});}
 const {slug}=await params;
 return withShopMutation(slug,({account})=>customerProfileDeletionResponse(request,account.username),['owner','admin']);
}
