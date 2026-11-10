import {sameOrigin} from '@/lib/auth';
import {withShopMutation} from '@/lib/shop-workspace';
import {connectShopGmail} from '@/lib/shop-gmail';
export async function POST(_request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();
 const {slug}=await params;
 return withShopMutation(slug,async({shop,account})=>connectShopGmail(slug,shop.id,account));
}
