import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {db,transaction} from './db';
import {baseUrl} from './config';
import {cookieOptions} from './auth';
import {random,sha,challenge,equal} from './crypto';
import {decryptGmail,encryptGmail,gmailAuthorization,exchangeGmailCode,type GmailConfig} from './gmail';
import {shopPath} from './shop-session';

type Actor={username:string;version:string};
const callback=(slug:string)=>baseUrl()+shopPath(slug)+'/connections/gmail/callback';
const back=(slug:string,status:string)=>NextResponse.redirect(baseUrl()+shopPath(slug)+'/connections?status='+status,303);
const cookieName=(id:string)=>'shop_gmail_oauth_'+id;
export async function connectShopGmail(slug:string,shopId:string,actor:Actor){
 const connection=await db.gmailConnection.findUnique({where:{id:'active'}});
 if(!connection)return back(slug,'not-configured');
 const state=random(),browser=random(),verifier=random();
 await db.gmailOAuthAttempt.create({data:{stateHash:sha(state),browserHash:sha(browser),actor:actor.username,actorVersion:actor.version,revision:connection.revision,verifier,expiresAt:new Date(Date.now()+600000)}});
 const response=NextResponse.redirect(gmailAuthorization(decryptGmail<GmailConfig>(connection.encryptedConfig),state,challenge(verifier),callback(slug)),303);
 response.cookies.set(cookieName(shopId),browser,{...cookieOptions,path:shopPath(slug),maxAge:600});
 return response;
}
export async function finishShopGmail(request:Request,slug:string,shopId:string,actor:Actor){
 const url=new URL(request.url),state=url.searchParams.get('state')??'',code=url.searchParams.get('code')??'';
 const jar=await cookies(),browser=jar.get(cookieName(shopId))?.value??'';
 const finish=(status:string)=>{
  const response=back(slug,status);
  response.cookies.set(cookieName(shopId),'',{...cookieOptions,path:shopPath(slug),maxAge:0});
  return response;
 };
 if(!state||state.length>256||!browser)return finish('invalid-state');
 try{
  const attempt=await transaction(async tx=>{
   const row=await tx.gmailOAuthAttempt.findUnique({where:{stateHash:sha(state)}});
   if(!row||row.consumedAt||row.expiresAt<=new Date()||row.actor!==actor.username||row.actorVersion!==actor.version||!equal(row.browserHash,sha(browser)))throw Error('INVALID_STATE');
   await tx.gmailOAuthAttempt.update({where:{stateHash:row.stateHash},data:{consumedAt:new Date()}});
   return row;
  });
  if(url.searchParams.has('error')||!code||code.length>4096)return finish('denied');
  const connection=await db.gmailConnection.findUnique({where:{id:'active'}});
  if(!connection||connection.revision!==attempt.revision)return finish('settings-changed');
  const tokens=await exchangeGmailCode(decryptGmail<GmailConfig>(connection.encryptedConfig),code,attempt.verifier,callback(slug));
  await transaction(async tx=>{
   const result=await tx.gmailConnection.updateMany({where:{id:'active',revision:attempt.revision},data:{encryptedToken:encryptGmail({refreshToken:tokens.refreshToken}),email:tokens.email,connectedAt:new Date(),syncPageToken:null,lastSyncAt:null,historyId:null,watchExpiresAt:null,lastPushAt:null}});
   if(!result.count)throw Error('SETTINGS_CHANGED');
   await tx.auditLog.create({data:{actor:actor.username,action:'GMAIL_CONNECTED',entityId:'active',details:{}}});
  });
  return finish('connected');
 }catch{return finish('connection-failed');}
}
