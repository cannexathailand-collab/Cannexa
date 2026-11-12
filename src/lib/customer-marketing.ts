import {NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {db,transaction,userLock} from './db';
import {baseUrl,mockMode} from './config';
import {cookieOptions} from './auth';
import {random,readToken,sha,signToken} from './crypto';
import {authorizationUrl} from './line';
import {lineSettings} from './line-settings';
import {metaAdCode} from './meta-ad';
import {limit} from './rate-limit';
import {portalAccessCookie,portalCookie,portalPasswordCookie} from './customer-portal';
import {ownerEmployeeCookie} from './employee-view';
import {customerAgeCookie,customerAgeDuration,customerAgeToken} from './customer-age';
import {verifiedLineFriendship} from './line-friendship';

export const marketingCookie='customer_marketing_pending';
export const marketingDuration=600;
type MarketingPending={purpose:'CUSTOMER_MARKETING_PENDING';clickId:string;key:string;exp:number;retries?:number};

export function marketingPendingToken(clickId:string,key:string,retries:0|1=0){
 return signToken({purpose:'CUSTOMER_MARKETING_PENDING',clickId,key,retries,exp:Date.now()+marketingDuration*1000});
}
export function readMarketingPending(value:string){
 const token=readToken<MarketingPending>(value);
 if(token?.purpose!=='CUSTOMER_MARKETING_PENDING'||typeof token.clickId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(token.clickId)||typeof token.key!=='string'||!/^[a-f0-9]{64}$/.test(token.key)||typeof token.exp!=='number'||token.exp<=Date.now())return null;
 const retries=token.retries??0;
 return retries===0||retries===1?{...token,retries}:null;
}
export async function marketingPending(){return readMarketingPending((await cookies()).get(marketingCookie)?.value??'');}
export async function authenticatedMarketingChallenge(pending:MarketingPending){
 const [click,conversion,friend]=await Promise.all([
  db.click.findFirst({where:{id:pending.clickId,customerLanding:true,source:'LINE',userKey:pending.key},select:{id:true}}),
  db.conversion.findUnique({where:{userKey:pending.key,source:'LINE'},select:{id:true}}),
  verifiedLineFriendship(pending.key,null),
 ]);
 return click&&conversion?customerAgeToken(pending.key,click.id,conversion.id,friend===true):null;
}
export function clearMarketingCustomerSessions(response:NextResponse){
 for(const name of [portalCookie,portalAccessCookie,portalPasswordCookie,'customer_password_step','admin_session',ownerEmployeeCookie,customerAgeCookie])response.cookies.delete(name);
}
function marketingFailure(error:'unavailable'|'expired'){
 const response=NextResponse.redirect(baseUrl()+'/marketing/connect?error='+error);
 clearMarketingCustomerSessions(response);
 if(error==='expired')response.cookies.delete(marketingCookie);
 return response;
}
export async function startCustomerMarketing(request:NextRequest,recheck=false){
 const connection=mockMode()?null:await lineSettings();
 if(!connection)return marketingFailure('unavailable');
 const fresh=request.nextUrl.searchParams.get('fresh')==='1';
 const pending=recheck||!fresh?readMarketingPending(request.cookies.get(marketingCookie)?.value??''):null;
 if(recheck&&!pending)return marketingFailure('expired');
 if(pending){
  const challenge=await authenticatedMarketingChallenge(pending);
  if(challenge){
   const response=NextResponse.redirect(baseUrl()+'/customer/age');
   clearMarketingCustomerSessions(response);
   response.cookies.delete(marketingCookie);
   response.cookies.set(customerAgeCookie,challenge,{...cookieOptions,maxAge:customerAgeDuration});
   return response;
  }
  return marketingFailure('expired');
 }
 const link=await db.trackingLink.findFirst({where:{affiliate:{code:metaAdCode,active:true,archivedAt:null}}});
 if(!link)return marketingFailure('unavailable');
 if(!await limit('customer-marketing:'+link.id,5000)){
  const response=new NextResponse('กรุณารอสักครู่แล้วลองใหม่',{status:429});
  clearMarketingCustomerSessions(response);return response;
 }
 const state=random(),verifier=random(),nonce=random();
 const browser=random();
 const attempt={purpose:'CUSTOMER_MARKETING',lineRevision:connection.revision,stateHash:sha(state),browserHash:sha(browser),verifier,nonce,expiresAt:new Date(Date.now()+marketingDuration*1000)};
 await db.click.create({data:{affiliateId:link.affiliateId,linkId:link.id,source:'LINE',customerLanding:true,oauth:{create:attempt}}});
 const authorization=new URL(authorizationUrl(state,nonce,verifier,connection.settings));
 const response=NextResponse.redirect(authorization);
 clearMarketingCustomerSessions(response);
 response.cookies.delete(marketingCookie);
 response.cookies.set('oauth_'+sha(state).slice(0,16),browser,{...cookieOptions,maxAge:marketingDuration});
 return response;
}
export async function completeCustomerMarketing(clickId:string,key:string,conversion:{id:string}){
 return transaction(async tx=>{
  await userLock(tx,key);
  const click=await tx.click.findUnique({where:{id:clickId}});
  if(!click||!click.customerLanding||click.source!=='LINE'||click.userKey!==key)throw Error('INVALID_MARKETING_CLICK');
  const verified=await tx.conversion.findUnique({where:{id:conversion.id}});
  if(!verified||verified.userKey!==key||verified.source!=='LINE')throw Error('INVALID_MARKETING_CONVERSION');
  const existing=await tx.customer.findUnique({where:{lineUserKey:key}});
  if(!existing&&await verifiedLineFriendship(key,null)!==true)throw Error('LINE_FRIENDSHIP_REQUIRED');
  if(existing&&existing.code!==verified.customerCode)throw Error('LINK_CONFLICT');
  const bare=existing&&!existing.name&&!existing.phone&&!existing.address&&!existing.identityKey&&!existing.portalPasswordHash;
  const approved=bare?await tx.auditLog.findFirst({where:{entityId:existing.code,action:'CUSTOMER_REGISTRATION_APPROVED'},select:{id:true}}):null;
  const orders=bare?await tx.orderIntake.count({where:{customerCode:existing.code}}):0;
  const needsActivation=!existing||!!bare&&!approved&&!orders&&!existing.profileResetAt;
  const customer=existing?await tx.customer.update({where:{code:existing.code},data:{conversionId:existing.conversionId??verified.id,...(needsActivation?{registeredAt:existing.registeredAt??new Date(),portalRegistrationPending:false,portalProfileIncomplete:false}:{})}}):await tx.customer.create({data:{code:verified.customerCode,lineUserKey:key,conversionId:verified.id,registeredAt:new Date(),portalRegistrationPending:false,portalProfileIncomplete:false}});
  await tx.click.updateMany({where:{id:clickId,customerEnteredAt:null},data:{customerEnteredAt:new Date(),marketingCustomerCode:customer.code}});
  return customer;
 });
}
