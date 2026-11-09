import {NextResponse} from 'next/server';
import {currentAccount,cookieOptions,sameOrigin} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {signToken} from '@/lib/crypto';
import {storeViewCookie} from '@/lib/store-view';
export async function POST(request:Request){
 try{
  await sameOrigin();
  const actor=await currentAccount();
  if(actor.role!=='owner')return new Response('Forbidden',{status:403});
  const mode=(await request.formData()).get('mode');
  if(mode!=='enter'&&mode!=='exit')return new Response('Invalid view',{status:400});
  const response=NextResponse.redirect(baseUrl()+(mode==='enter'?'/admin/stock':'/admin'),303);
  if(mode==='enter')response.cookies.set(storeViewCookie,signToken({purpose:'OWNER_STORE_VIEW',owner:actor.username,version:actor.version,exp:Date.now()+3600000}),{...cookieOptions,maxAge:3600});
  else response.cookies.delete(storeViewCookie);
  return response;
 }catch{return new Response('Forbidden',{status:403});}
}
