import {metaAdCode} from "./meta-ad";
import {randomBytes,randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {z} from "zod";
import {roles,isEmployeeRole} from "./accounts";
import {baseUrl} from "./config";
import {passwordHash} from "./crypto";
import {transaction} from "./db";

const fields=z.object({username:z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,64}$/),role:z.enum(roles),affiliateId:z.string().max(100).default(""),password:z.string().max(256)});
export async function saveUserAccount(req:Request,actor:string,returnPath="/admin/users"){
 const back=(status:string,reason?:string)=>NextResponse.redirect(baseUrl()+returnPath+"?"+new URLSearchParams({status,...(reason?{reason}:{})}),303);
 try{
  const form=await req.formData();
  const parsed=fields.safeParse(Object.fromEntries(form));
  if(!parsed.success)return back("error",String(parsed.error.issues[0]?.path[0]??""));
  const {username,role,affiliateId,password}=parsed.data;
  const edit=form.get("action")==="edit";
  if(username==="owner"||username===actor)return back("error","reserved");
  if((!edit&&password.length<8)||(password&&password.length<8))return back("error","password");
  if(isEmployeeRole(role)&&!affiliateId)return back("error","affiliate");
  const active=form.get("active")==="on";
  const salt=randomBytes(32).toString("hex");
  const credential=password?{salt,hash:passwordHash(password,salt)}:undefined;

  const values={role,affiliateId:isEmployeeRole(role)?affiliateId:null,active,version:randomUUID()};
  await transaction(async tx=>{
   const affiliate=isEmployeeRole(role)?await tx.affiliate.findUnique({where:{id:affiliateId},select:{code:true,archivedAt:true}}):null;
   if(isEmployeeRole(role)&&(!affiliate||affiliate.archivedAt))throw new Error("USER_AFFILIATE_UNAVAILABLE");
   if(affiliate?.code===metaAdCode)throw new Error("USER_AFFILIATE_UNAVAILABLE");
   if(edit)await tx.userAccount.update({where:{username},data:{...values,...credential}});
   else if(credential)await tx.userAccount.create({data:{username,...values,...credential}});
   await tx.auditLog.create({data:{actor,action:edit?"USER_UPDATED":"USER_CREATED",entityId:username,details:{role,active,passwordReset:!!credential}}});
  });
  return back("saved");
 }catch(error){
  if(error instanceof Error&&error.message==="USER_AFFILIATE_UNAVAILABLE")return back("error","affiliate");
  const code=(error as {code?:string}|null)?.code;
  if(code==="P2002")return back("error","duplicate");
  if(code==="P2025")return back("error","missing");
  return back("error");
 }
}
