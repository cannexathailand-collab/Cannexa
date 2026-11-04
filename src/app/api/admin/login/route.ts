import {NextRequest,NextResponse} from "next/server";
import {sameOrigin,cookieOptions} from "@/lib/auth";
import {equal,passwordHash,signToken} from "@/lib/crypto";
import {baseUrl} from "@/lib/config";
import {account,home} from "@/lib/accounts";
import {limit} from "@/lib/rate-limit";
export async function POST(req:NextRequest){
 await sameOrigin();
 // Global database-backed limit avoids trusting spoofable forwarded IP headers.
 if(!await limit("admin-login",20))return new Response("ลองอีกครั้งใน 15 นาที",{status:429});
 const data=await req.formData();
 const username=String(data.get("username")??"").trim().toLowerCase()||"owner";
 const password=String(data.get("password")??"");
 const a=username.length<=64?await account(username):null;
 const actual=passwordHash(password.slice(0,256),a?.salt??"invalid-account-salt");
 if(password.length>256||!a?.active||!equal(actual,a.hash))return NextResponse.redirect(baseUrl()+"/login?error=1",303);
 const res=NextResponse.redirect(baseUrl()+home(a.role),303);
 res.cookies.set("admin_session",signToken({role:a.role,username:a.username,version:a.version,exp:Date.now()+8*3600000}),{...cookieOptions,maxAge:28800});
 return res;
}
