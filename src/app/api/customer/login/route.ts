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
  if(!row||row.usedAt||row.expiresAt&&row.expiresAt<=new Date())return NextResponse.redirect(baseUrl()+'/customer?error=link');
 }
 if(!await limit('customer-login',1000))return new Response('กรุณาลองใหม่ภายหลัง',{status:429});
 const purpose=req.nextUrl.searchParams.get('register')==='1'?'CUSTOMER_REGISTER':req.nextUrl.searchParams.get('reset')==='1'?'CUSTOMER_PASSWORD_RESET':'CUSTOMER';
 const state=random(),browser=random(),verifier=random(),nonce=random();
 await db.oAuthAttempt.create({data:{purpose,customerLinkHash:linkHash,lineRevision:connection.revision,stateHash:sha(state),browserHash:sha(browser),verifier,nonce,expiresAt:new Date(Date.now()+600000)}});
 const authorization=new URL(authorizationUrl(state,nonce,verifier,connection.settings));
 if(req.nextUrl.searchParams.get('qr')==='1'){
  authorization.searchParams.set('initial_amr_display','lineqr');
  authorization.searchParams.set('disable_auto_login','true');
  authorization.searchParams.set('prompt','login');
 }
 const res=NextResponse.redirect(authorization);
 res.cookies.delete(customerAgeCookie);
 res.cookies.set('oauth_'+sha(state).slice(0,16),browser,{...cookieOptions,maxAge:600});return res;
}
