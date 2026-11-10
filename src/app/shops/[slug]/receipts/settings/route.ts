import {sameOrigin} from '@/lib/auth';
import {withShopMutation} from '@/lib/shop-workspace';
import {saveReceiptSettingsResponse} from '@/lib/receipt-http';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();const {slug}=await params;
 return withShopMutation(slug,async({account})=>saveReceiptSettingsResponse(request,account.username));
}
