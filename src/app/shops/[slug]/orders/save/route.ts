import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {withShopMutation} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {saveShopOrder} from '@/lib/shop-orders';
import {queueStockOrder} from '@/lib/stock-flow';
import {after} from 'next/server';
import {bindDatabase} from '@/lib/db';
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();
 const {slug}=await params;
 return withShopMutation(slug,async({account})=>{
  let status='saved';
  try{
   const order=await saveShopOrder(Object.fromEntries(await request.formData()),account);
   after(bindDatabase(async()=>{await queueStockOrder(order.id)}));
  }catch{status='error';}
  return NextResponse.redirect(baseUrl()+shopPath(slug)+'/orders?status='+status,303);
 },['owner','admin','manager','employee','sales']);
}
