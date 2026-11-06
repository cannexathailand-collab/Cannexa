import {metaAdCode} from "@/lib/meta-ad";
import {managers} from "@/lib/accounts";
import {NextRequest,NextResponse} from "next/server";
import {admin,sameOrigin} from "@/lib/auth";
import {transaction} from "@/lib/db";
import {baseUrl} from "@/lib/config";
import {z} from "zod";
import {commissionPercentBps} from '@/lib/sales-commission-rate';
const input=z.object({id:z.string().optional(),code:z.string().regex(/^[A-Z0-9_-]{3,30}$/),name:z.string().trim().min(1).max(100),notes:z.string().max(500),rateSatang:z.coerce.number().int().min(0).max(10000000),active:z.boolean(),salesCommissionBasis:z.enum(["REVENUE","PROFIT"]).default("REVENUE"),salesCommissionBps:z.number().int().min(0).max(10000).default(0)});
export async function POST(req:NextRequest){
 try{await admin(managers);await sameOrigin();const f=await req.formData();const data=input.parse({id:f.get("id")||undefined,code:f.get("code"),name:f.get("name"),notes:f.get("notes")??"",rateSatang:Math.round(Number(f.get("rate"))*100),active:f.get("active")==="on",salesCommissionBasis:f.get("salesCommissionBasis")??"REVENUE",salesCommissionBps:Math.round(Number(f.get("salesCommissionPercent")??0)*100)});
 await transaction(async tx=>{
  const {id,...legacy}=data;const values={...legacy,salesCommissionTransferBps:commissionPercentBps(f.get('salesCommissionTransferPercent')),salesCommissionCodBps:commissionPercentBps(f.get('salesCommissionCodPercent'))};const before=id?await tx.affiliate.findUniqueOrThrow({where:{id}}):null;
  if(before?.archivedAt||before?.code===metaAdCode)throw new Error("Reserved Meta ad link");
  const row=id?await tx.affiliate.update({where:{id},data:values}):await tx.affiliate.create({data:{...values,link:{create:{}}}});
  await tx.auditLog.create({data:{actor:"admin",action:id?"AFFILIATE_UPDATED":"AFFILIATE_CREATED",entityId:row.id,details:{before:before?{code:before.code,name:before.name,active:before.active,rateSatang:before.rateSatang,salesCommissionBasis:before.salesCommissionBasis,salesCommissionBps:before.salesCommissionBps,salesCommissionTransferBps:before.salesCommissionTransferBps,salesCommissionCodBps:before.salesCommissionCodBps}:null,after:values}}});
 });
 return NextResponse.redirect(baseUrl()+"/admin/affiliates",303);
 }catch(e){return new Response(e instanceof Error&&e.message==="UNAUTHORIZED"?"Unauthorized":"ข้อมูลไม่ถูกต้องหรือรหัสซ้ำ",{status:e instanceof Error&&e.message==="UNAUTHORIZED"?401:400});}
}
