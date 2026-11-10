import {createCipheriv,createDecipheriv,createHmac,randomBytes} from "node:crypto";
import {z} from "zod";
import {env,baseUrl} from "./config";
export const gmailScope="https://www.googleapis.com/auth/gmail.readonly";
export const gmailConfig=z.object({clientId:z.string().trim().regex(/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/),clientSecret:z.string().trim().min(1).max(1024)});
export type GmailConfig=z.infer<typeof gmailConfig>;
function encryptionKey(){return createHmac("sha256",env("SESSION_SECRET")).update("cannexa/gmail/v1").digest();}
export function encryptGmail(value:unknown){const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64url");}
export function decryptGmail<T>(value:string):T{const data=Buffer.from(value,"base64url"),cipher=createDecipheriv("aes-256-gcm",encryptionKey(),data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString("utf8")) as T;}
export const gmailCallback=()=>baseUrl()+"/api/admin/gmail/callback";
export function gmailAuthorization(config:GmailConfig,state:string,challenge:string,callback=gmailCallback()){const url=new URL("https://accounts.google.com/o/oauth2/v2/auth");for(const [key,value]of Object.entries({client_id:config.clientId,redirect_uri:callback,response_type:"code",scope:gmailScope,access_type:"offline",prompt:"consent",state,code_challenge:challenge,code_challenge_method:"S256"}))url.searchParams.set(key,value);return url.toString();}
export async function exchangeGmailCode(config:GmailConfig,code:string,verifier:string,callback=gmailCallback()){
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,code,code_verifier:verifier,redirect_uri:callback,grant_type:"authorization_code"}),cache:"no-store",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error("GMAIL_EXCHANGE_FAILED");
 const tokens=z.object({access_token:z.string().min(1),refresh_token:z.string().min(1),scope:z.string()}).parse(await response.json());
 if(!tokens.scope.split(" ").includes(gmailScope))throw new Error("GMAIL_SCOPE_MISSING");
 const profile=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile",{headers:{Authorization:"Bearer "+tokens.access_token},cache:"no-store",signal:AbortSignal.timeout(15000)});
 if(!profile.ok)throw new Error("GMAIL_PROFILE_FAILED");
 return {refreshToken:tokens.refresh_token,email:z.object({emailAddress:z.email()}).parse(await profile.json()).emailAddress};
}
