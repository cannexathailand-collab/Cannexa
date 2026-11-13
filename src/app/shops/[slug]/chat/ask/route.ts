import {withShopMutation} from '@/lib/shop-workspace';
import {adminChatResponse} from '@/lib/admin-chat-service';
export const maxDuration=90;
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 return withShopMutation(slug,({account})=>adminChatResponse(request,account,true),['owner','admin']);
}
