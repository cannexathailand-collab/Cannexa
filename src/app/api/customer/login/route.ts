import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {random,sha} from '@/lib/crypto';
import {baseUrl,mockMode} from '@/lib/config';
import {cookieOptions} from '@/lib/auth';
import {lineSettings} from '@/lib/line-settings';
import {authorizationUrl} from '@/lib/line';
import {limit} from '@/lib/rate-limit';
import {customerAgeCookie} from '@/lib/customer-age';
export async function GET(req:NextRequest){
 if(mockMode())return NextResponse.redirect(baseUrl()+'/customer?error=unavailable');
 const connection=await lineSettings();
 if(!connection)return NextResponse.redirect(baseUrl()+'/customer?error=unavailable');
 const link=req.nextUrl.searchParams.get('link');let linkHash:string|undefined;
 if(link){
  if(!/^[A-Za-z0-9_-]{43}$/.test(link))return NextResponse.redirect(baseUrl()+'/customer?error=link');
  linkHash=sha(link);const row=await db.customerAccessLink.findUnique({where:{tokenHash:linkHash}});
  if(!row||row.usedAt||row.expiresAt<=new Date())return NextResponse.redirect(baseUrl()+'/customer?error=link');
 }
 if(!await limit('customer-login',1000))return new Response('กรุณาลองใหม่ภายหลัง',{status:429});
 const state=random(),browser=random(),verifier=random(),nonce=random();
 await db.oAuthAttempt.create({data:{purpose:'CUSTOMER',customerLinkHash:linkHash,lineRevision:connection.revision,stateHash:sha(state),browserHash:sha(browser),verifier,nonce,expiresAt:new Date(Date.now()+600000)}});
 const res=NextResponse.redirect(authorizationUrl(state,nonce,verifier,connection.settings));
 res.cookies.delete(customerAgeCookie);
 res.cookies.set('oauth_'+sha(state).slice(0,16),browser,{...cookieOptions,maxAge:600});return res;
}
