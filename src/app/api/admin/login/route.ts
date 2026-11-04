import {NextRequest,NextResponse} from "next/server";
import {sameOrigin,cookieOptions} from "@/lib/auth";
import {equal,passwordHash,signToken} from "@/lib/crypto";
import {env,baseUrl} from "@/lib/config";
import {limit} from "@/lib/rate-limit";
export async function POST(req:NextRequest){
 await sameOrigin();
 // Global database-backed limit avoids trusting spoofable forwarded IP headers.
 if(!await limit("admin-login",20))return new Response("ลองอีกครั้งใน 15 นาที",{status:429});
 const data=await req.formData();
 const actual=passwordHash(String(data.get("password")??""),env("ADMIN_PASSWORD_SALT"));
 if(!equal(actual,env("ADMIN_PASSWORD_HASH")))return NextResponse.redirect(baseUrl()+"/login?error=1",303);
 const res=NextResponse.redirect(baseUrl()+"/admin",303);
 res.cookies.set("admin_session",signToken({role:"admin",exp:Date.now()+8*3600000}),{...cookieOptions,maxAge:28800});
 return res;
}
