import {NextRequest} from "next/server";
import {z} from "zod";
import {validSignature,userKey} from "@/lib/crypto";
import {env,mockMode} from "@/lib/config";
import {webhook} from "@/lib/tracking";
const payload=z.object({destination:z.string(),events:z.array(z.object({webhookEventId:z.string(),type:z.string(),timestamp:z.number(),source:z.object({userId:z.string().optional()}).passthrough(),follow:z.object({isUnblocked:z.boolean().optional()}).optional()}).passthrough())});
export async function POST(req:NextRequest){
 if(mockMode())return new Response("Real webhook disabled in mock mode",{status:409});
 const raw=await req.text();if(Buffer.byteLength(raw)>1024*1024)return new Response("Too large",{status:413});
 if(!validSignature(raw,req.headers.get("x-line-signature")??"",env("LINE_MESSAGING_CHANNEL_SECRET")))return new Response("Invalid signature",{status:401});
 let body:unknown;try{body=JSON.parse(raw);}catch{return new Response("Invalid JSON",{status:400});}const parsed=payload.safeParse(body);if(!parsed.success||parsed.data.destination!==env("LINE_BOT_USER_ID"))return new Response("Invalid payload",{status:400});
 for(const e of parsed.data.events){if(!e.source.userId||!["follow","unfollow"].includes(e.type))continue;await webhook({id:e.webhookEventId,key:userKey(e.source.userId),type:e.type,at:new Date(e.timestamp),unblocked:e.follow?.isUnblocked??null});}
 return Response.json({ok:true});
}
