import {selectedEmployee} from '@/lib/employee-view';
import {after} from 'next/server';
import {currentAccount,sameOrigin} from '@/lib/auth';
import {isEmployeeRole} from '@/lib/accounts';
import {db} from '@/lib/db';
import {changeOrder} from '@/lib/order-changes';
import {syncStockReservation} from '@/lib/stock-flow';
export const maxDuration=60;
export async function POST(request:Request){
 let actor:Awaited<ReturnType<typeof currentAccount>>;
 try{actor=await currentAccount();await sameOrigin();if(actor.role!=='owner'&&!isEmployeeRole(actor.role))throw Error('FORBIDDEN');}
 catch{return Response.json({error:'ไม่มีสิทธิ์ยกเลิกออเดอร์'},{status:403});}
 try{
  const text=await request.text();if(text.length>20000)throw Error('ข้อมูลมากเกินไป');
  const input=JSON.parse(text);
  if(typeof input.id!=='string'||!input.id||input.id.length>100)throw Error('กรุณาระบุออเดอร์');
  const selected=actor.role==='owner'?await selectedEmployee(actor):null;
  const seller=selected?.username??actor.username;
  const order=await db.orderIntake.findUnique({where:{id:input.id},select:{sellerUsername:true}});
  if(order?.sellerUsername!==seller)return Response.json({error:'ยกเลิกได้เฉพาะออเดอร์ที่คุณเป็นผู้ขาย'},{status:403});
  const result=await changeOrder(actor.username,{id:input.id,expectedVersion:input.expectedVersion,requestKey:input.requestKey,action:'CANCEL',reason:'ผู้ขายยกเลิกผ่านหน้ารายการออเดอร์'},undefined,{sellerUsername:seller});
  after(async()=>{await syncStockReservation(result.id,actor.username).catch(()=>{});});
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'ยกเลิกออเดอร์ไม่สำเร็จ'},{status:400});}
}
