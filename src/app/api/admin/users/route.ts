import {randomBytes,randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {z} from "zod";
import {admin,sameOrigin} from "@/lib/auth";
import {roles} from "@/lib/accounts";
import {baseUrl} from "@/lib/config";
import {passwordHash} from "@/lib/crypto";
import {transaction} from "@/lib/db";

const fields=z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,64}$/),role:z.enum(roles),affiliateId:z.string().max(100),password:z.string().max(256)});
export async function POST(req:Request){
 let actor:string;
 try{actor=await admin();await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 const back=(status:string)=>NextResponse.redirect(baseUrl()+"/admin/users?status="+status,303);
 try{
  const form=await req.formData();
  const {username,role,affiliateId,password}=fields.parse(Object.fromEntries(form));
  const edit=form.get("action")==="edit";
  if(username==="owner"||(!edit&&password.length<8)||(password&&password.length<8)||(role==="employee"&&!affiliateId))return back("error");
  const active=form.get("active")==="on";
  const salt=randomBytes(32).toString("hex");
  const credential=password?{salt,hash:passwordHash(password,salt)}:undefined;
  const values={role,affiliateId:role==="employee"?affiliateId:null,active,version:randomUUID()};
  await transaction(async tx=>{
   if(edit)await tx.userAccount.update({where:{username},data:{...values,...credential}});
   else if(credential)await tx.userAccount.create({data:{username,...values,...credential}});
   await tx.auditLog.create({data:{actor,action:edit?"USER_UPDATED":"USER_CREATED",entityId:username,details:{role,active,passwordReset:!!credential}}});
  });
  return back("saved");
 }catch{return back("error");}
}
