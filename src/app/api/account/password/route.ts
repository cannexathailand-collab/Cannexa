import {randomBytes,randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {currentAccount,sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
import {equal,passwordHash} from "@/lib/crypto";
import {transaction} from "@/lib/db";
import {limit} from "@/lib/rate-limit";

export async function POST(req:Request){
 const a=await currentAccount().catch(()=>null);
 if(!a)return new Response("Forbidden",{status:403});
 try{await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 const back=()=>NextResponse.redirect(baseUrl()+"/account/password?error=1",303);
 if(!await limit("password:"+a.username,10))return back();
 const f=await req.formData();
 const old=String(f.get("old")??""), password=String(f.get("password")??"");
 if(old.length>256||password.length<8||password.length>256||password!==f.get("confirm")||!equal(passwordHash(old,a.salt),a.hash))return back();
 const salt=randomBytes(32).toString("hex");
 const values={salt,hash:passwordHash(password,salt),version:randomUUID()};
 try{
  await transaction(async tx=>{
   if(a.username==="owner"&&a.version==="initial"){
    await tx.userAccount.create({data:{username:a.username,role:"owner",...values}});
   }else{
    const update=await tx.userAccount.updateMany({where:{username:a.username,version:a.version,active:true},data:values});
    if(update.count!==1)throw new Error("Stale session");
   }
   await tx.auditLog.create({data:{actor:a.username,action:"PASSWORD_CHANGED",entityId:a.username,details:{}}});
  });
 }catch{return back();}
 const response=NextResponse.redirect(baseUrl()+"/login?changed=1",303);
 response.cookies.delete("admin_session");
 return response;
}
