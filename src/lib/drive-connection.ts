import {randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
import {db,transaction} from './db';
import {baseUrl} from './config';
import {currentAccount,cookieOptions} from './auth';
import {random,sha,challenge,equal} from './crypto';
import {decryptGmail,encryptGmail,gmailCallback,type GmailConfig} from './gmail';

export const driveScope='https://www.googleapis.com/auth/drive.readonly';
export function driveFolderId(value:string){
 const raw=value.trim();if(!raw)return null;
 const id=raw.startsWith('https://drive.google.com/')?new URL(raw).pathname.match(/\/folders\/([\w-]+)/)?.[1]:raw;
 if(!id||!/^[\w-]{10,200}$/.test(id))throw Error('DRIVE_FOLDER_INVALID');return id;
}
export function driveAuthorization(config:GmailConfig,state:string,verifier:string){
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 for(const [key,value] of Object.entries({client_id:config.clientId,redirect_uri:gmailCallback(),response_type:'code',scope:driveScope,access_type:'offline',prompt:'consent',include_granted_scopes:'true',state,code_challenge:challenge(verifier),code_challenge_method:'S256'}))url.searchParams.set(key,value);
 return url.toString();
}
const back=(status:string)=>NextResponse.redirect(baseUrl()+'/admin/drive?status='+status,303);
export async function connectDrive(){
 const actor=await currentAccount();let connection=await db.driveConnection.findUnique({where:{id:'active'}});
 if(!connection){const google=await db.gmailConnection.findUnique({where:{id:'active'}});if(!google)return back('not-configured');connection=await db.driveConnection.create({data:{id:'active',encryptedConfig:google.encryptedConfig,revision:randomUUID()}});}
 const state='drive.'+random(),browser=random(),verifier=random();
 await db.driveOAuthAttempt.create({data:{stateHash:sha(state),browserHash:sha(browser),actor:actor.username,actorVersion:actor.version,revision:connection.revision,verifier,expiresAt:new Date(Date.now()+600000)}});
 const response=NextResponse.redirect(driveAuthorization(decryptGmail<GmailConfig>(connection.encryptedConfig),state,verifier),303);
 response.cookies.set('drive_oauth',browser,{...cookieOptions,maxAge:600});return response;
}
export async function finishDriveOAuth(request:Request){
 const actor=await currentAccount(),url=new URL(request.url),state=url.searchParams.get('state')??'',code=url.searchParams.get('code')??'';
 const jar=await cookies(),browser=jar.get('drive_oauth')?.value??'';jar.delete('drive_oauth');
 if(!/^drive\.[A-Za-z0-9_-]{40,100}$/.test(state)||!browser)return back('invalid-state');
 try{
  const attempt=await transaction(async tx=>{const item=await tx.driveOAuthAttempt.findUnique({where:{stateHash:sha(state)}});if(!item||item.consumedAt||item.expiresAt<=new Date()||item.actor!==actor.username||item.actorVersion!==actor.version||!equal(item.browserHash,sha(browser)))throw Error('INVALID_STATE');await tx.driveOAuthAttempt.update({where:{stateHash:item.stateHash},data:{consumedAt:new Date()}});return item;});
  if(url.searchParams.has('error')||!code||code.length>4096)return back('denied');
  const connection=await db.driveConnection.findUnique({where:{id:'active'}});if(!connection||connection.revision!==attempt.revision)return back('settings-changed');
  const config=decryptGmail<GmailConfig>(connection.encryptedConfig);
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,code,code_verifier:attempt.verifier,redirect_uri:gmailCallback(),grant_type:'authorization_code'}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('DRIVE_EXCHANGE_FAILED');const token=await response.json();
  if(typeof token.access_token!=='string'||typeof token.refresh_token!=='string'||!String(token.scope).split(' ').includes(driveScope))throw Error('DRIVE_SCOPE_MISSING');
  const profile=await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',{headers:{Authorization:'Bearer '+token.access_token},cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!profile.ok)throw Error('DRIVE_PROFILE_FAILED');const data=await profile.json();
  await transaction(async tx=>{const changed=await tx.driveConnection.updateMany({where:{id:'active',revision:attempt.revision},data:{encryptedToken:encryptGmail({refreshToken:token.refresh_token}),email:typeof data.user?.emailAddress==='string'?data.user.emailAddress:null,connectedAt:new Date()}});if(!changed.count)throw Error('SETTINGS_CHANGED');await tx.auditLog.create({data:{actor:actor.username,action:'DRIVE_CONNECTED',entityId:'active',details:{}}});});
  return back('connected');
 }catch{return back('connection-failed');}
}
export async function driveAccess(){
 const connection=await db.driveConnection.findUnique({where:{id:'active'}});if(!connection?.encryptedToken)throw Error('DRIVE_NOT_CONNECTED');
 const config=decryptGmail<GmailConfig>(connection.encryptedConfig),token=decryptGmail<{refreshToken:string}>(connection.encryptedToken);
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,refresh_token:token.refreshToken,grant_type:'refresh_token'}),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('DRIVE_RECONNECT');const result=await response.json();if(typeof result.access_token!=='string')throw Error('DRIVE_RECONNECT');
 return {token:result.access_token as string,folderId:connection.folderId};
}
