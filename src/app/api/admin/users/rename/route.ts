import {NextResponse} from "next/server";
import {admin,sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
import {renameUser} from "@/lib/rename-user";
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 const f=await req.formData();
 try{await renameUser(String(f.get("originalUsername")??""),String(f.get("newUsername")??""),actor);return NextResponse.redirect(baseUrl()+"/admin/users?status=renamed",303);}
 catch{return NextResponse.redirect(baseUrl()+"/admin/users?status=rename-error",303);}
}
