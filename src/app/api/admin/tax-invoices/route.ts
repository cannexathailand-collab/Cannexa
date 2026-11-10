import {currentAccount,sameOrigin} from '@/lib/auth';
import {documentOperators,requireOrderDocumentAccess} from '@/lib/order-document-access';
import {billingMutationResponse} from '@/lib/billing-http';
export async function POST(request:Request){
 try{
  await sameOrigin();const actor=await currentAccount();
  if(!documentOperators.some(role=>role===actor.role))throw Error('FORBIDDEN');
  const input=await request.clone().json();
  if(typeof input.orderId!=='string')throw Error('FORBIDDEN');
  await requireOrderDocumentAccess(actor,input.orderId,true);
  return billingMutationResponse(request,actor.username,'tax-invoice',actor);
 }catch{return Response.json({error:'ไม่มีสิทธิ์ออกเอกสารออเดอร์นี้'},{status:403});}
}
