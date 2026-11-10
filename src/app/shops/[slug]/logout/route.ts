import {NextResponse} from 'next/server';
import {sameOrigin,cookieOptions} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {activeShop,shopCookieName,shopPath} from '@/lib/shop-session';

export async function POST(_request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();
 const {slug}=await params,shop=await activeShop(slug);
 const response=NextResponse.redirect(baseUrl()+shopPath(slug)+'/login',303);
 if(shop)response.cookies.set(shopCookieName(shop.id),'',{...cookieOptions,path:shopPath(slug),maxAge:0});
 return response;
}
