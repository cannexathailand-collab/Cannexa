import {db} from "@/lib/db";
import {equal} from "@/lib/crypto";
import {pushKey,processGmailNotification} from "@/lib/gmail-push";
import {decodeGmailPush} from "@/lib/gmail-push-payload";
async function recordFailure(reason:string){await db.auditLog.create({data:{actor:"gmail-push",action:"GMAIL_PUSH_FAILED",entityId:"active",details:{reason}}}).catch(()=>{});}
export const maxDuration=60;
export async function POST(req:Request,{params}:{params:Promise<{key:string}>}){
 const {key}=await params,connection=await db.gmailConnection.findUnique({where:{id:"active"}});
 if(!connection?.encryptedToken||!equal(key,pushKey(connection.revision)))return new Response("Not found",{status:404});
 const raw=await req.text();if(Buffer.byteLength(raw)>100000)return new Response("Too large",{status:413});
 let data;try{data=decodeGmailPush(raw);}catch{await recordFailure("INVALID_PAYLOAD");return new Response("Invalid notification",{status:400});}
 if(data.emailAddress.toLowerCase()!==connection.email?.toLowerCase()){await recordFailure("WRONG_MAILBOX");return new Response("Invalid account",{status:400});}
 try{await processGmailNotification(data.emailAddress);return new Response(null,{status:204});}catch(e){const allowed=["GMAIL_RECONNECT","GMAIL_PUSH_API_FAILED","GMAIL_HISTORY_TOO_LARGE","GMAIL_READ_FAILED","SHIPMENT_CONFLICT","COD_CONFLICT"];await recordFailure(e instanceof Error&&allowed.includes(e.message)?e.message:"PROCESSING_FAILED");return new Response("Retry later",{status:503});}
}
