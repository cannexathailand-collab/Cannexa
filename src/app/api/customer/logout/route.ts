import {NextResponse} from 'next/server';
import {sameOrigin,cookieOptions} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {portalCookie,portalAccessCookie} from '@/lib/customer-portal';
export async function POST(){
 try{await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 const response=NextResponse.redirect(baseUrl()+'/customer',303);response.cookies.set(portalCookie,'',{...cookieOptions,maxAge:0});response.cookies.delete(portalAccessCookie);response.cookies.delete('customer_password_step');return response;
}
