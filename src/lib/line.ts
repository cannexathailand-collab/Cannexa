import {env,baseUrl} from "./config";
import type {LineSettings} from "./line-settings";
import {challenge} from "./crypto";
export function authorizationUrl(state:string,nonce:string,verifier:string,settings?:LineSettings){const u=new URL("https://access.line.me/oauth2/v2.1/authorize");u.search=new URLSearchParams({response_type:"code",client_id:(settings?.loginId??env("LINE_LOGIN_CHANNEL_ID")),redirect_uri:baseUrl()+"/api/line/callback",scope:"openid profile",state,nonce,prompt:"consent",bot_prompt:"aggressive",code_challenge:challenge(verifier),code_challenge_method:"S256"}).toString();return u.toString();}
async function request(url:string,init:RequestInit){const r=await fetch(url,{...init,signal:AbortSignal.timeout(10000),cache:"no-store"});if(!r.ok)throw new Error("LINE API error "+r.status);return r.json();}
export async function exchange(code:string,verifier:string,nonce:string,settings?:LineSettings){
 const token=await request("https://api.line.me/oauth2/v2.1/token",{method:"POST",body:new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:baseUrl()+"/api/line/callback",client_id:(settings?.loginId??env("LINE_LOGIN_CHANNEL_ID")),client_secret:(settings?.loginSecret??env("LINE_LOGIN_CHANNEL_SECRET")),code_verifier:verifier})});
 const id=await request("https://api.line.me/oauth2/v2.1/verify",{method:"POST",body:new URLSearchParams({id_token:token.id_token,client_id:(settings?.loginId??env("LINE_LOGIN_CHANNEL_ID")),nonce})});
 if(id.iss!=="https://access.line.me"||id.aud!==(settings?.loginId??env("LINE_LOGIN_CHANNEL_ID"))||id.nonce!==nonce||!id.sub||id.exp*1000<=Date.now())throw new Error("Invalid ID token");
 let friendFlag:boolean|null=null,friendshipError:string|null=null;
 try{const f=await request("https://api.line.me/friendship/v1/status",{headers:{Authorization:"Bearer "+token.access_token}});if(typeof f.friendFlag==="boolean")friendFlag=f.friendFlag;else friendshipError='INVALID_RESPONSE';}
 catch(error){const status=error instanceof Error?error.message.match(/^LINE API error (\d{3})$/)?.[1]:undefined;friendshipError=status?'HTTP_'+status:'NETWORK_ERROR';}
 return {userId:String(id.sub),displayName:typeof id.name==='string'?id.name.trim().slice(0,200)||null:null,friendFlag,friendshipError};
}
