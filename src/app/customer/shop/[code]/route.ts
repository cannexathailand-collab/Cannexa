import {NextResponse} from 'next/server';
import {baseUrl} from '@/lib/config';
import {cookieOptions} from '@/lib/auth';
import {customerShopProduct,shopEntryCookie} from '@/lib/customer-shop-link';

export async function GET(_request:Request,{params}:{params:Promise<{code:string}>}){
 const code=customerShopProduct((await params).code);
 if(!code)return new Response('Not found',{status:404});
 const response=NextResponse.redirect(baseUrl()+'/customer?'+new URLSearchParams({tab:'shop',product:code}));
 // Navigation only: this cookie never grants access to customer or order data.
 response.cookies.set(shopEntryCookie,code,{...cookieOptions,httpOnly:false,path:'/customer',maxAge:600});
 response.headers.set('Cache-Control','no-store');
 return response;
}
