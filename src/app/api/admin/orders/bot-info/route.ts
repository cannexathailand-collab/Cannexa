import {admin,sameOrigin} from "@/lib/auth";
import {getOrderBotInfo} from "@/lib/order-bot-info";
export async function POST(req:Request){
 try{await admin();await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 const raw=await req.text();if(Buffer.byteLength(raw)>6000)return new Response("Too large",{status:413});
 let token:string;try{const body=JSON.parse(raw);if(typeof body.accessToken!=="string")throw new Error();token=body.accessToken.trim();}catch{return Response.json({error:"กรอก Channel Access Token ก่อน"},{status:400});}
 try{return Response.json(await getOrderBotInfo(token),{headers:{"Cache-Control":"no-store"}});}catch(e){const code=e instanceof Error?e.message:"";return Response.json({error:code==="INVALID_TOKEN"?"Channel Access Token ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบโทเค็นของ Messaging API":"ติดต่อ LINE เพื่อดึงข้อมูลบอทไม่สำเร็จ กรุณาลองใหม่"},{status:code==="INVALID_TOKEN"?400:502,headers:{"Cache-Control":"no-store"}});}
}
