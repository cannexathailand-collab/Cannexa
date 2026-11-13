import {admin,currentAccount,sameOrigin} from '@/lib/auth';
import {stockEditors} from '@/lib/accounts';
import {createOaBatch} from '@/lib/line-oa-batch';
export const maxDuration=60;
export async function POST(request:Request){
 let actor:string;try{actor=await admin(stockEditors);await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์สร้างงาน'},{status:403});}
 try{
  const body=await request.text();if(body.length>512000)throw Error('INVALID_INPUT');
  const result=await createOaBatch(actor,JSON.parse(body),(await currentAccount()).role==='owner');
  const messages:Record<string,string>={OA_JOB_ALREADY_PENDING:'มีงานสินค้านี้กำลังทำอยู่',OA_TARGET_UNAVAILABLE:'OA นี้ยังไม่พร้อมใช้งาน',OA_PREVIEW_EXPIRED:'ข้อมูลตัวอย่างหมดอายุ กรุณาเตรียมใหม่',OA_PREVIEW_CHANGED:'ข้อมูลสินค้าเปลี่ยนแล้ว กรุณาเตรียมใหม่'};
  return Response.json({jobs:result.jobs,failures:result.failures.map(item=>({account:item.account,name:item.name,error:messages[item.code]??'เข้าคิวไม่สำเร็จ กรุณาลองอีกครั้ง'}))});
 }catch(error){
  const code=error instanceof Error?error.message:'';
  return Response.json({error:code==='OA_TARGET_FORBIDDEN'?'ไม่มีสิทธิ์ใช้ OA ที่เลือก':code==='OA_BROWSER_NOT_CONFIGURED'?'กรุณาเชื่อม LINE OA ก่อน':'ตรวจสอบรายชื่อ OA และข้อมูลที่เลือก'},{status:409});
 }
}
