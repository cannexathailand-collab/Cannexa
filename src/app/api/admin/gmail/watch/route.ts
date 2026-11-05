import {NextResponse} from "next/server";
import {admin,sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
import {enableGmailWatch} from "@/lib/gmail-push";
export async function POST(req:Request){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 const form=await req.formData();try{await enableGmailWatch(String(form.get("topicName")??"").trim(),actor);return NextResponse.redirect(baseUrl()+"/admin/gmail?status=watch-enabled",303);}catch{return NextResponse.redirect(baseUrl()+"/admin/gmail?status=watch-error",303);}
}
