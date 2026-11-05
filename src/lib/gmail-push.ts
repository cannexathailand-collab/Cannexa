import {createHmac} from "node:crypto";
import {z} from "zod";
import {db,transaction,userLock} from "./db";
import {baseUrl,env} from "./config";
import {decryptGmail,type GmailConfig} from "./gmail";
import {accessToken,importGmailReports,matchShipments} from "./gmail-reports";
export const topicPattern=/^projects\/[a-z][a-z0-9-]{4,61}[a-z0-9]\/topics\/[A-Za-z][A-Za-z0-9._~+%-]{2,254}$/;
export const pushKey=(revision:string)=>createHmac("sha256",env("SESSION_SECRET")).update("gmail-push/v1:"+revision).digest("hex");
export const pushUrl=(revision:string)=>baseUrl()+"/api/gmail/push/"+pushKey(revision);
async function gmailClient(){const connection=await db.gmailConnection.findUnique({where:{id:"active"}});if(!connection?.encryptedToken)throw new Error("GMAIL_RECONNECT");const token=await accessToken(decryptGmail<GmailConfig>(connection.encryptedConfig),decryptGmail<{refreshToken:string}>(connection.encryptedToken).refreshToken);const api=async(path:string,body?:object)=>{const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:"no-store",signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error("GMAIL_PUSH_API_FAILED");return response.json();};return {connection,api};}
export async function enableGmailWatch(topicName:string,actor:string){
 if(!topicPattern.test(topicName))throw new Error("INVALID_TOPIC");const {connection,api}=await gmailClient();
 const result=z.object({historyId:z.string().regex(/^\d+$/),expiration:z.string().regex(/^\d+$/)}).parse(await api("watch",{topicName}));
 const expiresAt=new Date(Number(result.expiration));if(!Number.isFinite(expiresAt.getTime())||expiresAt<new Date())throw new Error("INVALID_WATCH");
 await transaction(async tx=>{await userLock(tx,"gmail-history");const current=await tx.gmailConnection.findUnique({where:{id:"active"}});if(current?.revision!==connection.revision||!current.encryptedToken)throw new Error("GMAIL_RECONNECT");await tx.gmailConnection.update({where:{id:"active"},data:{topicName,watchExpiresAt:expiresAt,historyId:current.historyId??result.historyId}});await tx.auditLog.create({data:{actor,action:"GMAIL_WATCH_ENABLED",entityId:"active",details:{}}});});
}
export async function processGmailNotification(email:string){
 const {connection,api}=await gmailClient();if(email.toLowerCase()!==connection.email?.toLowerCase()||!connection.topicName||!connection.historyId)throw new Error("INVALID_NOTIFICATION");
 const messageIds=new Set<string>();let pageToken:string|undefined,historyId=connection.historyId;
 do{const p=new URLSearchParams({startHistoryId:connection.historyId,historyTypes:"messageAdded",maxResults:"100"});if(pageToken)p.set("pageToken",pageToken);const result=await api("history?"+p);for(const history of result.history??[])for(const entry of history.messagesAdded??[])if(typeof entry.message?.id==="string")messageIds.add(entry.message.id);if(messageIds.size>200)throw new Error("GMAIL_HISTORY_TOO_LARGE");pageToken=result.nextPageToken;historyId=result.historyId??historyId;}while(pageToken);
 // The existing importer checks each message's sender before reading attachments.
 if(messageIds.size)await importGmailReports("gmail-push",[...messageIds]);
 const matches=await matchShipments("gmail-push");
 await transaction(async tx=>{await userLock(tx,"gmail-history");const current=await tx.gmailConnection.findUnique({where:{id:"active"}});if(current?.revision!==connection.revision||!current.encryptedToken)return;await tx.gmailConnection.update({where:{id:"active"},data:{lastPushAt:new Date(),...(BigInt(historyId)>BigInt(current.historyId??"0")?{historyId}:{})}});});
 if(!connection.watchExpiresAt||connection.watchExpiresAt.getTime()<Date.now()+2*86400000)await enableGmailWatch(connection.topicName,"gmail-push");
 return matches;
}
