import {sameOrigin} from '@/lib/auth';
import {withShopMutation} from '@/lib/shop-workspace';
import {uploadShipmentFile} from '@/lib/upload-shipment-file';
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();
 const {slug}=await params;
 return withShopMutation(slug,async({account})=>uploadShipmentFile(request,account.username),['owner','store']);
}
