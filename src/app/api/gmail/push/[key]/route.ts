import {z} from "zod";
import {db} from "@/lib/db";
import {equal} from "@/lib/crypto";
import {pushKey,processGmailNotification} from "@/lib/gmail-push";
export const maxDuration=60;
export async function POST(req:Request,{params}:{params:Promise<{key:string}>}){
 const {key}=await params,connection=await db.gmailConnection.findUnique({where:{id:"active"}});
 if(!connection?.encryptedToken||!equal(key,pushKey(connection.revision)))return new Response("Not found",{status:404});
 const raw=await req.text();if(Buffer.byteLength(raw)>100000)return new Response("Too large",{status:413});
 let data;try{const envelope=z.object({message:z.object({data:z.string().max(50000),messageId:z.string()})}).parse(JSON.parse(raw));data=z.object({emailAddress:z.email(),historyId:z.string().regex(/^\d+$/)}).parse(JSON.parse(Buffer.from(envelope.message.data,"base64").toString("utf8")));}catch{return new Response("Invalid notification",{status:400});}
 if(data.emailAddress.toLowerCase()!==connection.email?.toLowerCase())return new Response("Invalid account",{status:400});
 try{await processGmailNotification(data.emailAddress);return new Response(null,{status:204});}catch{return new Response("Retry later",{status:503});}
}
