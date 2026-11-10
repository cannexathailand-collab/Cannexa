import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {transaction} from '@/lib/db';
import {baseUrl} from '@/lib/config';
import {withShopMutation} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();
 const {slug}=await params;
 return withShopMutation(slug,async({account})=>{
  const form=await request.formData(),code=String(form.get('code')??'').trim().toUpperCase(),name=String(form.get('name')??'').trim();
  let status='saved';
  try{
   if(!/^[A-Z0-9_-]{3,30}$/.test(code)||!name||name.length>100)throw Error('INVALID_TEAM');
   await transaction(async tx=>{
    const team=await tx.affiliate.create({data:{code,name,rateSatang:0,link:{create:{}}}});
    await tx.auditLog.create({data:{actor:account.username,action:'AFFILIATE_CREATED',entityId:team.id,details:{code,name}}});
   });
  }catch{status='error';}
  return NextResponse.redirect(baseUrl()+shopPath(slug)+'/users?status='+status,303);
 });
}
