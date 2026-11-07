import {NextResponse} from 'next/server';
import {sameOrigin,cookieOptions} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {portalCookie,portalAccessCookie,portalPasswordCookie,portalCustomer} from '@/lib/customer-portal';
export async function POST(){
 try{await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 const {method}=await portalCustomer();
 const response=NextResponse.redirect(baseUrl()+(method==='password'?'/customer/sign-in':'/customer'),303);response.cookies.set(portalCookie,'',{...cookieOptions,maxAge:0});response.cookies.delete(portalAccessCookie);response.cookies.delete(portalPasswordCookie);response.cookies.delete('customer_password_step');return response;
}
