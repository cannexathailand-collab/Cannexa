import {NextResponse,after} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {shopPath} from '@/lib/shop-session';
import {withShopMutation} from '@/lib/shop-workspace';
import {confirmStockReturnReceived,processStockReturn} from '@/lib/stock-return';
import {bindDatabase} from '@/lib/db';
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();const {slug}=await params;
 return withShopMutation(slug,async({account})=>{
  let status='saved';
  try{
   const form=await request.formData(),tracking=String(form.get('tracking')??'');
   if(form.get('confirm')!=='yes')throw Error('CONFIRM_REQUIRED');
   await confirmStockReturnReceived(tracking,account.username);
   after(bindDatabase(async()=>{await processStockReturn(tracking,account.username)}));
  }catch{status='error';}
  return NextResponse.redirect(baseUrl()+shopPath(slug)+'/stock/returns?status='+status,303);
 },['owner','store']);
}
