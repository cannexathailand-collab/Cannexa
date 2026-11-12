import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {random,sha} from '@/lib/crypto';
import {baseUrl,mockMode} from '@/lib/config';
import {cookieOptions} from '@/lib/auth';
import {lineSettings} from '@/lib/line-settings';
import {authorizationUrl} from '@/lib/line';
import {limit} from '@/lib/rate-limit';
import {customerAgeCookie} from '@/lib/customer-age';
import {friendRetryCookie,friendRetryDuration,friendRetryToken,readFriendRetry} from '@/lib/customer-friend-gate';
export async function GET(req:NextRequest){
 if(mockMode())return NextResponse.redirect(baseUrl()+'/customer?error=unavailable');
 const connection=await lineSettings();
 if(!connection)return NextResponse.redirect(baseUrl()+'/customer?error=unavailable');
 const link=req.nextUrl.searchParams.get('link');let linkHash:string|undefined;
 const retry=req.nextUrl.searchParams.get('retry')==='1'?readFriendRetry(req.cookies.get(friendRetryCookie)?.value??''):null;
 if(req.nextUrl.searchParams.get('retry')==='1'&&!retry)return NextResponse.redirect(baseUrl()+'/customer/friendship?status=expired');
 if(link){
  if(!/^[A-Za-z0-9_-]{43}$/.test(link))return NextResponse.redirect(baseUrl()+'/customer?error=link');
  linkHash=sha(link);const row=await db.customerAccessLink.findUnique({where:{tokenHash:linkHash}});
  if(!row||row.usedAt||row.expiresAt&&row.expiresAt<=new Date())return NextResponse.redirect(baseUrl()+'/customer?error=link');
 }
 if(retry?.linkHash){
  const row=await db.customerAccessLink.findUnique({where:{tokenHash:retry.linkHash}});
  if(!row||row.usedAt||row.expiresAt&&row.expiresAt<=new Date())return NextResponse.redirect(baseUrl()+'/customer?error=link');
  linkHash=retry.linkHash;
 }
 if(!await limit('customer-login',1000))return new Response('กรุณาลองใหม่ภายหลัง',{status:429});
 const purpose=retry?.intent??(req.nextUrl.searchParams.get('register')==='1'?'CUSTOMER_REGISTER':req.nextUrl.searchParams.get('reset')==='1'?'CUSTOMER_PASSWORD_RESET':'CUSTOMER');
 const state=random(),browser=random(),verifier=random(),nonce=random();
 await db.oAuthAttempt.create({data:{purpose,clickId:retry?.clickId??undefined,customerLinkHash:linkHash,lineRevision:connection.revision,stateHash:sha(state),browserHash:sha(browser),verifier,nonce,expiresAt:new Date(Date.now()+600000)}});
 const authorization=new URL(authorizationUrl(state,nonce,verifier,connection.settings));
 if(req.nextUrl.searchParams.get('qr')==='1'){
  authorization.searchParams.set('initial_amr_display','lineqr');
  authorization.searchParams.set('disable_auto_login','true');
  authorization.searchParams.set('prompt','login');
 }
 const res=NextResponse.redirect(authorization);
 if(retry)res.cookies.set(friendRetryCookie,friendRetryToken({...retry,stateHash:sha(state)}),{...cookieOptions,maxAge:friendRetryDuration});
 else res.cookies.delete(friendRetryCookie);
 res.cookies.delete(customerAgeCookie);
 res.cookies.set('oauth_'+sha(state).slice(0,16),browser,{...cookieOptions,maxAge:600});return res;
}
