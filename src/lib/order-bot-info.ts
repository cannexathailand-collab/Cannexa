import {z} from "zod";
const botInfo=z.object({userId:z.string().regex(/^U[0-9a-f]{32}$/i),displayName:z.string().min(1).max(200),basicId:z.string()});
export async function getOrderBotInfo(accessToken:string){
 if(!accessToken||accessToken.length>4096||/\s/.test(accessToken))throw new Error("INVALID_TOKEN");
 let response:Response;
 try{response=await fetch("https://api.line.me/v2/bot/info",{headers:{Authorization:"Bearer "+accessToken},cache:"no-store",signal:AbortSignal.timeout(10000)});}catch{throw new Error("LINE_UNAVAILABLE");}
 if(!response.ok)throw new Error([401,403].includes(response.status)?"INVALID_TOKEN":"LINE_UNAVAILABLE");
 try{return botInfo.parse(await response.json());}catch{throw new Error("INVALID_BOT_RESPONSE");}
}
