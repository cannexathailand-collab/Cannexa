import {withShopMutation} from '@/lib/shop-workspace';
import {finishShopGmail} from '@/lib/shop-gmail';
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 return withShopMutation(slug,async({shop,account})=>finishShopGmail(request,slug,shop.id,account));
}
