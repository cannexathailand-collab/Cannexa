import {createCipheriv,createDecipheriv,createHmac,randomBytes} from "node:crypto";
import {db,isSeparateShopDatabase} from "./db";
import {env} from "./config";

export type LineSettings={loginId:string;loginSecret:string;messagingSecret:string;botId:string;basicId:string;accessToken?:string};
function key(){return createHmac("sha256",env("SESSION_SECRET")).update("cannexa/line-settings/v1").digest();}
export function seal(settings:LineSettings){
 const iv=randomBytes(12), cipher=createCipheriv("aes-256-gcm",key(),iv);
 const data=Buffer.concat([cipher.update(JSON.stringify(settings),"utf8"),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64url");
}
export function unseal(value:string):LineSettings{
 const data=Buffer.from(value,"base64url");
 const cipher=createDecipheriv("aes-256-gcm",key(),data.subarray(0,12));
 cipher.setAuthTag(data.subarray(12,28));
 return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString("utf8"));
}
export async function lineSettings():Promise<{settings:LineSettings;revision:string}|null>{
 const row=await db.lineConnection.findUnique({where:{id:"active"}});
 if(row?.encrypted==="")return null;
 if(row)return {settings:unseal(row.encrypted),revision:row.revision};
 if(isSeparateShopDatabase())return null;
 const settings={loginId:process.env.LINE_LOGIN_CHANNEL_ID??"",loginSecret:process.env.LINE_LOGIN_CHANNEL_SECRET??"",messagingSecret:process.env.LINE_MESSAGING_CHANNEL_SECRET??"",botId:process.env.LINE_BOT_USER_ID??"",basicId:process.env.LINE_OA_BASIC_ID??""};
 return Object.values(settings).every(Boolean)?{settings,revision:"environment"}:null;
}
