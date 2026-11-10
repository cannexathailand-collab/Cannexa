import {NextResponse} from 'next/server';
import {sameOrigin,cookieOptions} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {activeShop,shopPath,shopViewCookieName} from '@/lib/shop-session';
export async function POST(_request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();const {slug}=await params,shop=await activeShop(slug);
 const response=NextResponse.redirect(baseUrl()+'/platform',303);
 if(shop)response.cookies.set(shopViewCookieName(shop.id),'',{...cookieOptions,path:shopPath(slug),maxAge:0});
 return response;
}
