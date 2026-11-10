import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {withShopMutation} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {baseUrl} from '@/lib/config';
import {transaction} from '@/lib/db';
import {lineSettings,seal} from '@/lib/line-settings';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();const {slug}=await params;
 return withShopMutation(slug,async({account})=>{
  const form=await request.formData();let status='saved';
  try{
   const line=await lineSettings();if(!line)throw Error('LINE_NOT_CONNECTED');
   await transaction(async tx=>{
    const enabled=form.get('enabled')==='on';
    if(form.get('action')==='bot'){
     await tx.orderBot.upsert({where:{botId:line.settings.botId},create:{botId:line.settings.botId,name:line.settings.basicId,encrypted:seal(line.settings),active:enabled,receiveOrders:enabled},update:{encrypted:seal(line.settings),active:enabled,receiveOrders:enabled}});
    }else if(form.get('action')==='group'){
     const id=String(form.get('id')??''),name=String(form.get('name')??'').trim();if(name.length>100)throw Error('INVALID_GROUP');
     const group=await tx.orderGroup.findUniqueOrThrow({where:{id}});if(group.botId!==line.settings.botId||group.purpose!=='ORDER')throw Error('INVALID_GROUP');
     await tx.orderGroup.update({where:{id},data:{name,enabled}});
    }else throw Error('INVALID_ACTION');
    await tx.auditLog.create({data:{actor:account.username,action:'ORDER_GROUP_UPDATED',entityId:String(form.get('id')??line.settings.botId),details:{enabled}}});
   });
  }catch{status='error';}
  return NextResponse.redirect(baseUrl()+shopPath(slug)+'/connections?status='+status,303);
 });
}
