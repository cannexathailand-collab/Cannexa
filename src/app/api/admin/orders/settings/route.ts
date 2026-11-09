import {NextResponse} from "next/server";
import {admin,sameOrigin} from "@/lib/auth";
import {db,transaction} from "@/lib/db";
import {baseUrl} from "@/lib/config";
import {seal} from "@/lib/line-settings";
import {getOrderBotInfo} from "@/lib/order-bot-info";
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 const f=await req.formData();const action=String(f.get("action")??"");
 if(action==="bot"){
  const name=String(f.get("name")??"").trim(),messagingSecret=String(f.get("secret")??"").trim(),accessToken=String(f.get("accessToken")??"").trim();
  if(!name||name.length>100||!messagingSecret||messagingSecret.length>200)return new Response("Invalid settings",{status:400});
  let info;try{info=await getOrderBotInfo(accessToken);}catch{return new Response("ดึงข้อมูล OA ไม่สำเร็จ กรุณากลับไปตรวจ Channel Access Token แล้วลองอีกครั้ง",{status:400});}
  const botId=info.userId;
  const encrypted=seal({loginId:"",loginSecret:"",basicId:info.basicId,botId,messagingSecret,accessToken});
  await transaction(async tx=>{
   const bot=await tx.orderBot.upsert({where:{botId},create:{name,botId,encrypted},update:{name,encrypted,active:true}});
   await tx.auditLog.create({data:{actor,action:"ORDER_BOT_SAVED",entityId:bot.id,details:{name}}});
  });
 }else if(action==="intake"){
  const id=String(f.get("id")??""),receiveOrders=f.get("receiveOrders")==="on";
  if(!id||!await db.orderBot.findUnique({where:{id}}))return new Response("Invalid bot",{status:400});
  await transaction(async tx=>{
   await tx.orderBot.update({where:{id},data:{receiveOrders}});
   await tx.auditLog.create({data:{actor,action:"ORDER_BOT_INTAKE_UPDATED",entityId:id,details:{receiveOrders}}});
  });
 }else if(action==="group"){
  const id=String(f.get("id")??""),name=String(f.get("name")??"").trim(),enabled=f.get("enabled")==="on";
  if(!id||!name||name.length>100||!await db.orderGroup.findUnique({where:{id}}))return new Response("Invalid group",{status:400});
  await transaction(async tx=>{
   await tx.orderGroup.update({where:{id},data:{name,enabled}});
   await tx.auditLog.create({data:{actor,action:"ORDER_GROUP_UPDATED",entityId:id,details:{name,enabled}}});
  });
 }else return new Response("Invalid action",{status:400});
 return NextResponse.redirect(baseUrl()+"/admin/orders",303);
}
