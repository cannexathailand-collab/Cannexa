import {admin,currentAccount,sameOrigin} from '@/lib/auth';
import {stockEditors} from '@/lib/accounts';
import {availableOaTargets,requestOaAccountRefresh} from '@/lib/line-oa-accounts';

export async function GET(){
 try{await admin(stockEditors);}catch{return new Response('Forbidden',{status:403});}
 const actor=await currentAccount(),data=await availableOaTargets();
 return Response.json({
  accounts:actor.role==='owner'?data.accounts:data.accounts.filter(account=>account.account===data.connection?.account),
  defaultAccount:data.connection?.account??'',status:data.connection?.status??'DISCONNECTED',
  updatedAt:data.connection?.accountsUpdatedAt,error:data.connection?.accountsError,canRefresh:actor.role==='owner',
 },{headers:{'Cache-Control':'no-store'}});
}
export async function POST(){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 try{await requestOaAccountRefresh(actor);return Response.json({ok:true});}
 catch(error){return Response.json({error:error instanceof Error&&error.message==='OA_BUSY'?'มีงานกำลังบันทึกอยู่ กรุณารอให้เสร็จก่อนโหลดรายชื่อ':'กรุณาเชื่อม LINE OA ก่อนโหลดรายชื่อ'},{status:409});}
}
