import {bindDatabase} from '@/lib/db';
import {saveLineMessageRecipient} from '@/lib/line-message-recipient';
import {bindProfitReportRecipient} from '@/lib/owner-profit-report';
import {processPendingStockDispatches} from '@/lib/stock-dispatch';
import {NextRequest} from "next/server";
import {after} from 'next/server';
import {processPendingReservations,queueStockOrder} from '@/lib/stock-flow';
export const maxDuration=60;
import {z} from "zod";
import {validSignature,userKey} from "@/lib/crypto";
import {mockMode} from "@/lib/config";
import {webhook} from "@/lib/tracking";
import {lineSettings,unseal} from "@/lib/line-settings";
import {db} from "@/lib/db";
import {replyExpenseConfirmation} from "@/lib/expense-confirmation";
import {receiveExpenseEvent} from "@/lib/expense-intake";
import {receiveOrderEvent} from "@/lib/order-intake";
import {replyOrderConfirmation} from "@/lib/order-confirmation";
const payload=z.object({destination:z.string(),events:z.array(z.object({webhookEventId:z.string(),type:z.string(),replyToken:z.string().max(200).optional(),timestamp:z.number().int().min(0).max(8640000000000000),source:z.object({type:z.string().optional(),groupId:z.string().optional(),userId:z.string().optional()}).passthrough(),message:z.object({type:z.string(),id:z.string(),text:z.string().max(10000).optional()}).passthrough().optional(),unsend:z.object({messageId:z.string()}).optional(),follow:z.object({isUnblocked:z.boolean().optional()}).optional()}).passthrough()).max(100)});
export async function POST(req:NextRequest){
 if(mockMode())return new Response("Real webhook disabled in mock mode",{status:409});
 const connection=await lineSettings();if(!connection)return new Response("LINE not configured",{status:503});
 const raw=await req.text();if(Buffer.byteLength(raw)>1024*1024)return new Response("Too large",{status:413});
 if(!validSignature(raw,req.headers.get("x-line-signature")??"",connection.settings.messagingSecret))return new Response("Invalid signature",{status:401});
 let body:unknown;try{body=JSON.parse(raw);}catch{return new Response("Invalid JSON",{status:400});}const parsed=payload.safeParse(body);if(!parsed.success||parsed.data.destination!==connection.settings.botId)return new Response("Invalid payload",{status:400});
 const intakeBot=parsed.data.events.some(e=>e.source.type==="group")?await db.orderBot.findUnique({where:{botId:connection.settings.botId},select:{active:true,encrypted:true,receiveOrders:true}}):null;
 const orders:string[]=[];
 for(const e of parsed.data.events){
  if(e.source.type==='user'&&e.source.userId&&['message','follow','unfollow'].includes(e.type)){
   const recipientKey=userKey(connection.settings.botId===process.env.LINE_BOT_USER_ID?e.source.userId:connection.settings.botId+':'+e.source.userId);
   await saveLineMessageRecipient(recipientKey,connection.settings.botId,e.source.userId,{at:new Date(e.timestamp),friendFlag:e.type==='follow'?true:e.type==='unfollow'?false:undefined,messageAt:e.type==='message'?new Date(e.timestamp):undefined});
  }
  if(e.source.type==='user'&&e.source.userId&&e.type==='message'&&e.message?.type==='text'){
   const bound=await bindProfitReportRecipient({botId:connection.settings.botId,userId:e.source.userId,text:e.message.text??''});
   if(bound){
    if(e.replyToken&&connection.settings.accessToken)await fetch('https://api.line.me/v2/bot/message/reply',{method:'POST',headers:{Authorization:'Bearer '+connection.settings.accessToken,'Content-Type':'application/json'},body:JSON.stringify({replyToken:e.replyToken,messages:[{type:'text',text:'ผูก LINE รับรายงานยอดขายและกำไรขั้นต้นแล้ว จะส่งทุกวันตอนตัดรอบ'}]}),signal:AbortSignal.timeout(8000)}).catch(()=>{});
    continue;
   }
  }

  if(intakeBot?.active){
   const accessToken=unseal(intakeBot.encrypted).accessToken;
   if(intakeBot.receiveOrders){
    const received=await receiveOrderEvent(connection.settings.botId,e);
    if(received)orders.push(received.id);
    await replyOrderConfirmation(connection.settings.botId,e,accessToken);
   }
   await receiveExpenseEvent(connection.settings.botId,e);
   await replyExpenseConfirmation(connection.settings.botId,e,accessToken);
  }
  if(!e.source.userId||!["follow","unfollow"].includes(e.type))continue;
  const key=userKey(connection.settings.botId===process.env.LINE_BOT_USER_ID?e.source.userId:connection.settings.botId+":"+e.source.userId);
  await webhook({id:e.webhookEventId,key,type:e.type,at:new Date(e.timestamp),unblocked:e.follow?.isUnblocked??null});
 }
 if(intakeBot?.active)after(bindDatabase(async()=>{for(const id of orders)await queueStockOrder(id).catch(()=>{});await processPendingReservations(2).catch(()=>{});await processPendingStockDispatches('line-order',1).catch(()=>{});}));
 return Response.json({ok:true});
}
