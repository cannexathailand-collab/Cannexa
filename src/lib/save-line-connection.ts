import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {z} from "zod";
import {baseUrl,mockMode} from "./config";
import {transaction} from "./db";
import {seal} from "./line-settings";
const input=z.object({loginId:z.string().trim().regex(/^\d{5,20}$/),loginSecret:z.string().trim().min(16).max(128),messagingSecret:z.string().trim().min(16).max(128),token:z.string().trim().min(16).max(4096)});
const bot=z.object({userId:z.string().regex(/^U[a-f0-9]{32}$/i),basicId:z.string().regex(/^@[\w.-]+$/)});
export async function saveLineConnection(req:Request){
 if(mockMode())return new Response("Disabled in mock mode",{status:409});
 const redirect=(status:string)=>NextResponse.redirect(baseUrl()+"/admin/line?status="+status,303);
 try{
  const form=await req.formData();
  if(form.get("action")==="disconnect"){
   const revision=randomUUID();
   await transaction(async tx=>{
    await tx.lineConnection.upsert({where:{id:"active"},create:{id:"active",encrypted:"",revision},update:{encrypted:"",revision}});
    await tx.auditLog.create({data:{actor:"admin",action:"LINE_CONNECTION_CLEARED",entityId:"active",details:{}}});
   });
   return redirect("cleared");
  }
  const f=input.parse(Object.fromEntries(form));
  const response=await fetch("https://api.line.me/v2/bot/info",{headers:{Authorization:"Bearer "+f.token},signal:AbortSignal.timeout(10000),cache:"no-store",redirect:"error"});
  if(!response.ok)return redirect("invalid");
  const {userId, basicId}=bot.parse(await response.json());
  const encrypted=seal({loginId:f.loginId,loginSecret:f.loginSecret,messagingSecret:f.messagingSecret,botId:userId,basicId,accessToken:f.token});
  const revision=randomUUID();
  await transaction(async tx=>{
   await tx.lineConnection.upsert({where:{id:"active"},create:{id:"active",encrypted,revision},update:{encrypted,revision}});
   await tx.auditLog.create({data:{actor:"admin",action:"LINE_CONNECTION_UPDATED",entityId:basicId,details:{loginId:f.loginId}}});
  });
  return redirect("saved");
 }catch{return redirect("invalid");}
}
