import {managers} from "@/lib/accounts";
import {NextRequest,NextResponse} from "next/server";
import {admin,sameOrigin} from "@/lib/auth";
import {transaction} from "@/lib/db";
import {baseUrl} from "@/lib/config";
import {z} from "zod";
const input=z.object({id:z.string().optional(),code:z.string().regex(/^[A-Z0-9_-]{3,30}$/),name:z.string().trim().min(1).max(100),notes:z.string().max(500),rateSatang:z.coerce.number().int().min(0).max(10000000),active:z.boolean()});
export async function POST(req:NextRequest){
 try{await admin(managers);await sameOrigin();const f=await req.formData();const data=input.parse({id:f.get("id")||undefined,code:f.get("code"),name:f.get("name"),notes:f.get("notes")??"",rateSatang:Math.round(Number(f.get("rate"))*100),active:f.get("active")==="on"});
 await transaction(async tx=>{
  const {id,...values}=data;const before=id?await tx.affiliate.findUniqueOrThrow({where:{id}}):null;
  const row=id?await tx.affiliate.update({where:{id},data:values}):await tx.affiliate.create({data:{...values,link:{create:{}}}});
  await tx.auditLog.create({data:{actor:"admin",action:id?"AFFILIATE_UPDATED":"AFFILIATE_CREATED",entityId:row.id,details:{before:before?{code:before.code,name:before.name,active:before.active,rateSatang:before.rateSatang}:null,after:values}}});
 });
 return NextResponse.redirect(baseUrl()+"/admin/affiliates",303);
 }catch(e){return new Response(e instanceof Error&&e.message==="UNAUTHORIZED"?"Unauthorized":"ข้อมูลไม่ถูกต้องหรือรหัสซ้ำ",{status:e instanceof Error&&e.message==="UNAUTHORIZED"?401:400});}
}
