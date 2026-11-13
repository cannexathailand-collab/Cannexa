import {withShopMutation} from '@/lib/shop-workspace';
import {sameOrigin} from '@/lib/auth';
import {saveOpenAiConnection} from '@/lib/openai-connection';
import {shopPath} from '@/lib/shop-session';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 return withShopMutation(slug,async({account})=>{
  try{await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
  let status='ai-saved';
  try{const form=await request.formData();await saveOpenAiConnection(account.username,{key:form.get('key'),model:form.get('model')});}catch{status='ai-failed';}
  return Response.redirect(new URL(shopPath(slug)+'/connections?status='+status,request.url),303);
 });
}
