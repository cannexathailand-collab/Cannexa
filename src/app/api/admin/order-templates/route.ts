import {admin,sameOrigin} from '@/lib/auth';
import {db} from '@/lib/db';
import {orderTemplateIssues} from '@/lib/order-templates';
export async function POST(req:Request){
 let actor:string;try{actor=await admin(['owner','admin','manager']);await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์ตั้งค่าแบบฟอร์ม'},{status:403});}
 try{
  const input=await req.json(),name=typeof input.name==='string'?input.name.trim():'',body=typeof input.body==='string'?input.body.trim():'';
  if(!name||name.length>80||!body||body.length>4000)return Response.json({error:'กรอกชื่อแบบฟอร์มและข้อความให้ครบ'},{status:400});
  const issues=orderTemplateIssues(body);if(issues.length)return Response.json({error:issues.join(' · ')},{status:400});
  const saved=await db.$transaction(async tx=>{const row=await tx.orderMessageTemplate.create({data:{name,body}});await tx.auditLog.create({data:{actor,action:'ORDER_TEMPLATE_CREATED',entityId:row.id,details:{name}}});return row;});
  return Response.json({template:{id:saved.id,name:saved.name,body:saved.body}});
 }catch{return Response.json({error:'บันทึกแบบฟอร์มไม่สำเร็จ'},{status:503});}
}
