import {NextRequest,NextResponse} from 'next/server';
import {sameOrigin,cookieOptions} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {signToken,sha} from '@/lib/crypto';
import {authenticateShop,shopCookieName,shopPath} from '@/lib/shop-session';
import {limit} from '@/lib/rate-limit';

export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();
 const {slug}=await params,data=await request.formData();
 const username=String(data.get('username')??'').trim().toLowerCase(),password=String(data.get('password')??'');
 const failed=()=>NextResponse.redirect(baseUrl()+shopPath(slug)+'/login?error=1',303);
 if(!await limit('shop-login:'+sha(slug+'\0'+username),20))return failed();
 const result=await authenticateShop(slug,username,password);
 if(!result)return failed();
 const {shop,account}=result,response=NextResponse.redirect(baseUrl()+shopPath(slug),303);
 response.cookies.set(shopCookieName(shop.id),signToken({audience:'shop',shopId:shop.id,username:account.username,version:account.version,exp:Date.now()+86400000}),{...cookieOptions,path:shopPath(slug),maxAge:86400});
 return response;
}
