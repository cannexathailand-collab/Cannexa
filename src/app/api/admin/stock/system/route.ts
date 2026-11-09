import {admin,sameOrigin} from '@/lib/auth';
import {activateStockWorkbook,syncStockWorkbook} from '@/lib/stock-workbook-sync';
export const maxDuration=60;
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return Response.json({error:'Forbidden'},{status:403});}
 try{
  const value=await req.json();
  if(value.action==='activate')return Response.json(await activateStockWorkbook(actor));
  if(value.action==='sync')return Response.json(await syncStockWorkbook());
  return Response.json({error:'Invalid action'},{status:400});
 }catch{return Response.json({error:'ยังเปลี่ยนระบบสต๊อกหรือซิงค์ชีทไม่สำเร็จ'},{status:503});}
}
