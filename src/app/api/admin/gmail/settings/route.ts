import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {admin,sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
import {transaction} from "@/lib/db";
import {gmailConfig,encryptGmail} from "@/lib/gmail";
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 const form=await req.formData();const back=(status:string)=>NextResponse.redirect(baseUrl()+"/admin/gmail?status="+status,303);
 if(form.get("action")==="disconnect"){
  await transaction(async tx=>{await tx.gmailConnection.updateMany({where:{id:"active"},data:{encryptedToken:null,email:null,connectedAt:null,syncPageToken:null,lastSyncAt:null,topicName:null,historyId:null,watchExpiresAt:null,lastPushAt:null,revision:randomUUID()}});await tx.gmailOAuthAttempt.deleteMany({});await tx.auditLog.create({data:{actor,action:"GMAIL_DISCONNECTED",entityId:"active",details:{}}});});return back("disconnected");
 }
 const parsed=gmailConfig.safeParse({clientId:form.get("clientId"),clientSecret:form.get("clientSecret")});if(!parsed.success)return back("invalid-settings");
 await transaction(async tx=>{const data={encryptedConfig:encryptGmail(parsed.data),revision:randomUUID(),encryptedToken:null,email:null,connectedAt:null,syncPageToken:null,lastSyncAt:null,topicName:null,historyId:null,watchExpiresAt:null,lastPushAt:null};await tx.gmailConnection.upsert({where:{id:"active"},create:{id:"active",...data},update:data});await tx.gmailOAuthAttempt.deleteMany({});await tx.auditLog.create({data:{actor,action:"GMAIL_CONFIGURED",entityId:"active",details:{}}});});return back("saved");
}
