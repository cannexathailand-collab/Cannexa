import {NextResponse,after} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {shopPath} from '@/lib/shop-session';
import {withShopMutation} from '@/lib/shop-workspace';
import {changeOrder} from '@/lib/order-changes';
import {syncStockReservation} from '@/lib/stock-flow';
import {bindDatabase} from '@/lib/db';
import {isEmployeeRole} from '@/lib/accounts';
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();const {slug}=await params;
 return withShopMutation(slug,async({account})=>{
  let status='changed',message='';
  try{
   const form=await request.formData(),action=String(form.get('action')??'');
   if(action==='EDIT'&&account.role!=='owner'||action==='CANCEL'&&form.get('confirm')!=='yes')throw Error('กรุณายืนยันการทำรายการ');
   const result=await changeOrder(account.username,Object.fromEntries(form),undefined,isEmployeeRole(account.role)?{sellerUsername:account.username}:undefined);
   after(bindDatabase(async()=>{await syncStockReservation(result.id,account.username)}));
  }catch(error){status='error';if(error instanceof Error&&/^[ก-๙]/.test(error.message))message=error.message.slice(0,500);}
  return NextResponse.redirect(baseUrl()+shopPath(slug)+'/orders?'+new URLSearchParams({status,message}),303);
 },['owner','employee','sales']);
}
