import {customerLoginDestination,customerLoginPurposes} from '@/lib/customer-login-intent';
import {saveLineMessageRecipient} from '@/lib/line-message-recipient';
import {NextRequest,NextResponse} from "next/server";
import {consume} from "@/lib/oauth";
import {exchange} from "@/lib/line";
import {recordLogin} from "@/lib/tracking";
import {userKey,sha,readToken} from "@/lib/crypto";
import {baseUrl,mockMode} from "@/lib/config";
import {db} from "@/lib/db";
import {syncLoginCustomer} from '@/lib/customer-code-message';
import {lineSettings} from "@/lib/line-settings";
import {lineCustomerDestination} from "@/lib/line-customer-destination";
import {linkPortalCustomer,portalCookie,portalAccessCookie,portalAccessToken,portalToken,portalDuration,portalPasswordCookie} from '@/lib/customer-portal';
import {cookieOptions} from '@/lib/auth';
import {ownerEmployeeCookie} from '@/lib/employee-view';
import {clearMarketingCustomerSessions,marketingCookie,marketingDuration,marketingPendingToken} from '@/lib/customer-marketing';
import {customerAgeCookie,customerAgeDuration,customerAgeToken} from '@/lib/customer-age';
export async function GET(req:NextRequest){
 if(mockMode())return new Response("Real callback disabled in mock mode",{status:409});
 let clickId:string|undefined;let customerLogin=false,marketingLogin=false;
 const state=req.nextUrl.searchParams.get("state")??"";
 try{
  if(/^[A-Za-z0-9_-]{40,100}$/.test(state)){
   const pending=await db.oAuthAttempt.findUnique({where:{stateHash:sha(state)},select:{purpose:true}});
   customerLogin=customerLoginPurposes.some(purpose=>purpose===pending?.purpose);
   marketingLogin=pending?.purpose==='CUSTOMER_MARKETING'||pending?.purpose==='CUSTOMER_MARKETING_RECHECK';
  }
  const a=await consume(state);clickId=a.clickId??undefined;customerLogin=customerLoginPurposes.includes(a.purpose);marketingLogin=a.purpose==='CUSTOMER_MARKETING'||a.purpose==='CUSTOMER_MARKETING_RECHECK';
  if(req.nextUrl.searchParams.has("error"))throw new Error("Login declined");
  const code=req.nextUrl.searchParams.get("code");if(!code)throw new Error("Missing code");
  const connection=await lineSettings();
  if(!connection||connection.revision!==(a.lineRevision??"environment"))throw new Error("LINE configuration changed");
  const result=await exchange(code,a.verifier,a.nonce,connection.settings);
  const changed=req.nextUrl.searchParams.get("friendship_status_changed");
  const key=userKey(connection.settings.botId===process.env.LINE_BOT_USER_ID?result.userId:connection.settings.botId+":"+result.userId);
  await saveLineMessageRecipient(key,connection.settings.botId,result.userId,{friendFlag:result.friendFlag});
  if(marketingLogin){
   if(!a.clickId)throw Error('Missing marketing click');
   const click=await db.click.findUnique({where:{id:a.clickId},select:{customerLanding:true}});
   if(!click?.customerLanding)throw Error('Invalid marketing click');
   let retries=0;
   if(a.purpose==='CUSTOMER_MARKETING_RECHECK'){
    const browser=readToken<{purpose?:string;clickId?:string;key?:string;exp?:number;retries?:number}>(req.cookies.get('oauth_'+sha(state).slice(0,16))?.value??'');
    if(browser?.purpose!=='CUSTOMER_MARKETING_RECHECK'||browser.clickId!==a.clickId||browser.key!==key||typeof browser.exp!=='number'||browser.exp<=Date.now()||browser.retries!==undefined&&browser.retries!==0&&browser.retries!==1)throw Error('Marketing identity changed');
    retries=browser.retries??0;
   }
   const conversion=await recordLogin(a.clickId,key,result.friendFlag,changed==='true'?true:changed==='false'?false:null);
   const destination=result.friendFlag===true?baseUrl()+'/customer/age':retries===0?baseUrl()+'/marketing/recheck':lineCustomerDestination(connection.settings.basicId,false);
   const response=NextResponse.redirect(destination);
   clearMarketingCustomerSessions(response);
   if(result.friendFlag===true){
    response.cookies.set(customerAgeCookie,customerAgeToken(key,a.clickId,conversion.id),{...cookieOptions,maxAge:customerAgeDuration});
    response.cookies.delete(marketingCookie);
   }else response.cookies.set(marketingCookie,marketingPendingToken(a.clickId,key,1),{...cookieOptions,maxAge:marketingDuration});
   response.cookies.delete('oauth_'+sha(state).slice(0,16));
   return response;
  }
  if(customerLogin){
   const customer=await linkPortalCustomer(key,a.customerLinkHash);
   const destination=customerLoginDestination(a.purpose,customer);
   const res=NextResponse.redirect(baseUrl()+destination);
   res.cookies.set(portalCookie,portalToken(key),{...cookieOptions,maxAge:portalDuration});
   res.cookies.delete(portalPasswordCookie);
   res.cookies.delete('admin_session');
   res.cookies.delete(ownerEmployeeCookie);
   res.cookies.delete(customerAgeCookie);
   if(customer&&!customer.portalRegistrationPending){
    res.cookies.set(portalAccessCookie,portalAccessToken(key,customer.code),{...cookieOptions,maxAge:portalDuration});
   }else{
    res.cookies.delete(portalAccessCookie);
   }
   res.cookies.delete('customer_password_step');
   res.cookies.delete('oauth_'+sha(state).slice(0,16));return res;
  }
  if(!a.clickId)throw new Error('Missing affiliate click');
  const customer=await recordLogin(a.clickId,key,result.friendFlag,changed==="true"?true:changed==="false"?false:null);
  const originalClick=await db.click.findUniqueOrThrow({where:{id:customer.clickId}});
  await syncLoginCustomer(key,customer,originalClick.metaFbc);
  const res=NextResponse.redirect(lineCustomerDestination(connection.settings.basicId,result.friendFlag));
  res.cookies.delete(customerAgeCookie);
  res.cookies.set('customer_result','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/result',maxAge:0});
  res.cookies.delete("oauth_"+sha(state).slice(0,16));return res;
 }catch{
  if(clickId)await db.click.update({where:{id:clickId},data:{loginResult:"FAILED"}});
  const res=NextResponse.redirect(baseUrl()+(marketingLogin?'/marketing/connect?error=login':customerLogin?'/customer?error=login':"/result?error=1"));
  if(marketingLogin)clearMarketingCustomerSessions(res);
  res.cookies.delete(customerAgeCookie);
  res.cookies.delete('oauth_'+sha(state).slice(0,16));return res;
 }
}
