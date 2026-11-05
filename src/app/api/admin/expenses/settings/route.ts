import {NextResponse} from 'next/server';import {admin,sameOrigin} from '@/lib/auth';import {transaction,userLock} from '@/lib/db';import {baseUrl} from '@/lib/config';
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response('Forbidden',{status:403});}
 const f=await req.formData(),id=String(f.get('id')??''),name=String(f.get('name')??'').trim(),enabled=f.get('enabled')==='on';if(!id||!name||name.length>100)return new Response('ระบุกลุ่มและชื่อกลุ่มให้ครบ',{status:400});
 try{await transaction(async tx=>{await userLock(tx,'expense-group:'+id);const group=await tx.orderGroup.findUniqueOrThrow({where:{id}});if(group.purpose!=='EXPENSE'&&(group.enabled||await tx.orderIntake.count({where:{groupKey:id}})))throw Error('ORDER_GROUP_IN_USE');await tx.orderGroup.update({where:{id},data:{name,enabled,purpose:'EXPENSE'}});await tx.auditLog.create({data:{actor,action:'EXPENSE_GROUP_UPDATED',entityId:id,details:{name,enabled}}});});return NextResponse.redirect(baseUrl()+'/admin/expenses',303);}catch{return new Response('กลุ่มนี้กำลังใช้รับออเดอร์ หรือไม่พบกลุ่ม กรุณาใช้กลุ่มค่าใช้จ่ายแยกต่างหาก',{status:409});}
}
