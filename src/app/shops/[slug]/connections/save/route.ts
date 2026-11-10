import {sameOrigin} from '@/lib/auth';
import {withShopMutation} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {saveLineConnection} from '@/lib/save-line-connection';
import {saveGmailConnection} from '@/lib/save-gmail-connection';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();
 const {slug}=await params,form=await request.clone().formData();
 return withShopMutation(slug,async({account})=>{
  const returnPath=shopPath(slug)+'/connections';
  if(form.get('service')==='line')return saveLineConnection(request,{returnPath,actor:account.username});
  if(form.get('service')==='gmail')return saveGmailConnection(request,account.username,returnPath);
  return new Response('Invalid service',{status:400});
 });
}
