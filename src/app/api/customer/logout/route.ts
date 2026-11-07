import {NextResponse} from 'next/server';
import {sameOrigin,cookieOptions} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {portalCookie} from '@/lib/customer-portal';
export async function POST(){
 try{await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 const response=NextResponse.redirect(baseUrl()+'/customer',303);response.cookies.set(portalCookie,'',{...cookieOptions,maxAge:0});return response;
}
