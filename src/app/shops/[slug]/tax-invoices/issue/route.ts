import {documentOperators,requireOrderDocumentAccess} from '@/lib/order-document-access';
import {sameOrigin} from '@/lib/auth';
import {withShopMutation} from '@/lib/shop-workspace';
import {billingMutationResponse} from '@/lib/billing-http';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();const {slug}=await params;
 return withShopMutation(slug,async({account})=>{const input=await request.clone().json();await requireOrderDocumentAccess(account,input.orderId,true);return billingMutationResponse(request,account.username,'tax-invoice',account);},documentOperators);
}
