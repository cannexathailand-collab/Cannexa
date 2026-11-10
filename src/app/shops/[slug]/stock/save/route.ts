import {NextResponse} from 'next/server';
import {sameOrigin} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {shopPath} from '@/lib/shop-session';
import {withShopMutation} from '@/lib/shop-workspace';
import {connectShopStock} from '@/lib/shop-stock';
import {newStockProduct} from '@/lib/stock-product-input';
import {appendStockProduct} from '@/lib/stock-google';
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();
 const {slug}=await params;
 return withShopMutation(slug,async({account})=>{
  let status='saved';
  try{
   if(Number(request.headers.get('content-length')??0)>64000)throw Error('TOO_LARGE');
   const form=await request.formData();
   if(form.get('action')==='connect'&&account.role==='owner')await connectShopStock(form,account.username);
   else if(form.get('action')==='add')await appendStockProduct(newStockProduct.parse({...Object.fromEntries(form),prices:[]}),account.username);
   else throw Error('INVALID_ACTION');
  }catch{status='error';}
  return NextResponse.redirect(baseUrl()+shopPath(slug)+'/stock?status='+status,303);
 },['owner','store']);
}
