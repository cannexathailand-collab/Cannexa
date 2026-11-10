import {sameOrigin} from '@/lib/auth';
import {withShopMutation} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {saveUserAccount} from '@/lib/save-user-account';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();
 const {slug}=await params;
 return withShopMutation(slug,async({account})=>saveUserAccount(request,account.username,shopPath(slug)+'/users'));
}
