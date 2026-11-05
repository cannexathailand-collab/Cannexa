import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {admin,currentAccount} from "@/lib/auth";
import {db,transaction} from "@/lib/db";
import {baseUrl} from "@/lib/config";
import {sha,equal} from "@/lib/crypto";
import {decryptGmail,encryptGmail,exchangeGmailCode,type GmailConfig} from "@/lib/gmail";
export async function GET(req:Request){
 const back=(status:string)=>NextResponse.redirect(baseUrl()+"/admin/gmail?status="+status,303);
 try{await admin();}catch{return back("session-expired");}
 const url=new URL(req.url),state=url.searchParams.get("state")??"",code=url.searchParams.get("code")??"",jar=await cookies(),browser=jar.get("gmail_oauth")?.value??"";jar.delete("gmail_oauth");
 if(!state||state.length>256||!browser)return back("invalid-state");
 const actor=await currentAccount();
 try{
  const attempt=await transaction(async tx=>{
   const a=await tx.gmailOAuthAttempt.findUnique({where:{stateHash:sha(state)}});
   if(!a||a.consumedAt||a.expiresAt<new Date()||a.actor!==actor.username||a.actorVersion!==actor.version||!equal(a.browserHash,sha(browser)))throw new Error("INVALID_STATE");
   await tx.gmailOAuthAttempt.update({where:{stateHash:a.stateHash},data:{consumedAt:new Date()}});return a;
  });
  if(url.searchParams.has("error")||!code||code.length>4096)return back("denied");
  const connection=await db.gmailConnection.findUnique({where:{id:"active"}});if(!connection||connection.revision!==attempt.revision)return back("settings-changed");
  const tokens=await exchangeGmailCode(decryptGmail<GmailConfig>(connection.encryptedConfig),code,attempt.verifier);
  await transaction(async tx=>{
   const updated=await tx.gmailConnection.updateMany({where:{id:"active",revision:attempt.revision},data:{encryptedToken:encryptGmail({refreshToken:tokens.refreshToken}),email:tokens.email,connectedAt:new Date(),syncPageToken:null,lastSyncAt:null,historyId:null,watchExpiresAt:null,lastPushAt:null}});if(!updated.count)throw new Error("SETTINGS_CHANGED");
   await tx.auditLog.create({data:{actor:actor.username,action:"GMAIL_CONNECTED",entityId:"active",details:{}}});
  });return back("connected");
 }catch{return back("connection-failed");}
}
