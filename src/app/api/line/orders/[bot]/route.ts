import {processPendingStockDispatches} from '@/lib/stock-dispatch';
import {after} from 'next/server';
import {processPendingReservations,queueStockOrder} from '@/lib/stock-flow';
export const maxDuration=60;
import {z} from "zod";
import {db} from "@/lib/db";
import {validSignature} from "@/lib/crypto";
import {unseal} from "@/lib/line-settings";
import {replyExpenseConfirmation} from "@/lib/expense-confirmation";
import {receiveExpenseEvent} from "@/lib/expense-intake";
import {receiveOrderEvent} from "@/lib/order-intake";
import {replyOrderConfirmation} from "@/lib/order-confirmation";
import {mockMode} from "@/lib/config";
const payload=z.object({destination:z.string(),events:z.array(z.object({webhookEventId:z.string().min(1),type:z.string(),replyToken:z.string().max(200).optional(),timestamp:z.number().int().min(0).max(8640000000000000),source:z.object({type:z.string().optional(),groupId:z.string().optional(),userId:z.string().optional()}).passthrough(),message:z.object({type:z.string(),id:z.string().min(1),text:z.string().max(10000).optional()}).passthrough().optional(),unsend:z.object({messageId:z.string()}).optional()}).passthrough()).max(100)});
export async function POST(req:Request,{params}:{params:Promise<{bot:string}>}){
 if(mockMode())return new Response("Real webhook disabled in mock mode",{status:409});
 const {bot}=await params;const connection=await db.orderBot.findUnique({where:{id:bot}});
 if(!connection?.active)return new Response("Not found",{status:404});
 const raw=await req.text();if(Buffer.byteLength(raw)>1024*1024)return new Response("Too large",{status:413});
 const settings=unseal(connection.encrypted);
 if(!validSignature(raw,req.headers.get("x-line-signature")??"",settings.messagingSecret))return new Response("Invalid signature",{status:401});
 let body:unknown;try{body=JSON.parse(raw);}catch{return new Response("Invalid JSON",{status:400});}
 const parsed=payload.safeParse(body);if(!parsed.success||parsed.data.destination!==connection.botId)return new Response("Invalid payload",{status:400});
 const orders:string[]=[];
 for(const e of parsed.data.events){
  if(connection.receiveOrders){
   const received=await receiveOrderEvent(connection.botId,e);
   if(received)orders.push(received.id);
   await replyOrderConfirmation(connection.botId,e,settings.accessToken);
  }
  await receiveExpenseEvent(connection.botId,e);
  await replyExpenseConfirmation(connection.botId,e,settings.accessToken);
 }
 after(async()=>{for(const id of orders)await queueStockOrder(id).catch(()=>{});await processPendingReservations(2).catch(()=>{});await processPendingStockDispatches('line-order',1).catch(()=>{});});
 return Response.json({ok:true});
}
