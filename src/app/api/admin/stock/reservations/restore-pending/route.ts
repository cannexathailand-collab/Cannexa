import {z} from 'zod';
import {admin,sameOrigin} from '@/lib/auth';
import {restorePendingOrders} from '@/lib/stock-restore-pending';
export const maxDuration=60;
const id=z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const input=z.object({requestKey:z.uuid(),orderIds:z.array(id).min(1).max(500),precountedOrderIds:z.array(id).max(500),reviewOrderIds:z.array(id).max(500)});
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์คืนรายการรอจ่าย'},{status:403});}
 try{const parsed=input.safeParse(await req.json());if(!parsed.success)return Response.json({error:'ระบุรายการรอจ่ายให้ครบ'},{status:400});return Response.json({ok:true,...await restorePendingOrders(parsed.data,actor)});}
 catch{return Response.json({error:'ยังยืนยันการคืนยอดรอจ่ายไม่ได้ กรุณาตรวจรายการแล้วลองคำขอเดิม'},{status:409});}
}
