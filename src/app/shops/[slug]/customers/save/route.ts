import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {withShopMutation} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {createDraftCustomer} from '@/lib/draft-customer-identity';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();const {slug}=await params;
 return withShopMutation(slug,async({account})=>{
  let status='saved',phone='';
  try{
   const form=await request.formData();phone=String(form.get('phone')??'');
   const result=await createDraftCustomer({name:String(form.get('name')??''),phone,address:String(form.get('address')??'')},account);
   if(!result.created)status='exists';
  }catch{status='error';}
  return NextResponse.redirect(baseUrl()+shopPath(slug)+'/customers?'+new URLSearchParams({status,...(status==='error'?{}:{q:phone})}),303);
 },['owner','admin','manager']);
}
