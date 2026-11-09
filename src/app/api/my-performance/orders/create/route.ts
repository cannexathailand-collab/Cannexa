import {after} from 'next/server';
import {currentAccount,sameOrigin} from '@/lib/auth';
import {isEmployeeRole} from '@/lib/accounts';
import {selectedEmployee} from '@/lib/employee-view';
import {createManualOrder} from '@/lib/manual-orders';
import {orderRejectionText} from '@/lib/order-validation';
import {processPendingReservations} from '@/lib/stock-flow';
export const maxDuration=60;
export async function POST(request:Request){
 let actor:Awaited<ReturnType<typeof currentAccount>>,employee:{username:string;affiliateId:string|null};
 try{
  actor=await currentAccount();await sameOrigin();
  if(actor.role==='owner'){
   const selected=await selectedEmployee(actor);
   if(!selected?.affiliateId)throw Error('FORBIDDEN');
   employee=selected;
  }else{
   if(!isEmployeeRole(actor.role)||!actor.affiliateId)throw Error('FORBIDDEN');
   employee=actor;
  }
 }catch{return Response.json({error:'ไม่มีสิทธิ์สร้างออเดอร์ในหน้าพนักงาน'},{status:403});}
 try{
  if(Number(request.headers.get('content-length')??0)>3*1024*1024)throw Error('ข้อมูลออเดอร์มีขนาดใหญ่เกินไป');
  const text=await request.text();if(text.length>3*1024*1024)throw Error('ข้อมูลออเดอร์มีขนาดใหญ่เกินไป');
  const result=await createManualOrder(actor.username,{...JSON.parse(text),sellerCode:employee.username});
  if('reasons' in result)return Response.json({error:orderRejectionText(result.reasons)},{status:400});
  after(async()=>{await processPendingReservations(2).catch(()=>{});});
  return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'บันทึกออเดอร์ไม่สำเร็จ'},{status:400});}
}
