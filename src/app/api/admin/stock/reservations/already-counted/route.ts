import {z} from 'zod';
import {admin,sameOrigin} from '@/lib/auth';
import {reconcileAlreadyCounted} from '@/lib/stock-reconcile';
export const maxDuration=60;
const input=z.object({requestKey:z.uuid(),orderIds:z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/)).min(1).max(500),confirmation:z.literal('นับในยอดจ่ายเดิมแล้ว')});
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์กระทบยอดสต๊อก'},{status:403});}
 try{const parsed=input.safeParse(await req.json());if(!parsed.success)return Response.json({error:'ระบุออเดอร์และยืนยันยอดเดิมให้ถูกต้อง'},{status:400});return Response.json({ok:true,...await reconcileAlreadyCounted(parsed.data,actor)});}
 catch{return Response.json({error:'ยังยืนยันการกระทบยอดไม่ได้ กรุณาตรวจสถานะรายการแล้วลองคำขอเดิม'},{status:409});}
}
