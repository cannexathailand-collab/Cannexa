import {NextRequest,NextResponse} from "next/server";
import {sameOrigin,cookieOptions} from "@/lib/auth";
import {equal,passwordHash,signToken} from "@/lib/crypto";
import {baseUrl} from "@/lib/config";
import {account,home} from "@/lib/accounts";
import {customerAgeCookie} from '@/lib/customer-age';
export async function POST(req:NextRequest){
 await sameOrigin();
 const data=await req.formData();
 const username=String(data.get("username")??"").trim().toLowerCase()||"owner";
 const password=String(data.get("password")??"");
 if(username.length>64)return NextResponse.redirect(baseUrl()+"/login?error=1",303);
 const a=await account(username);
 const actual=passwordHash(password.slice(0,256),a?.salt??"invalid-account-salt");
 if(password.length>256||!a?.active||!equal(actual,a.hash))return NextResponse.redirect(baseUrl()+"/login?error=1",303);
 const res=NextResponse.redirect(baseUrl()+home(a.role),303);
 res.cookies.set("admin_session",signToken({role:a.role,username:a.username,version:a.version,exp:Date.now()+30*86400000}),{...cookieOptions,maxAge:2592000});
 res.cookies.delete(customerAgeCookie);
 return res;
}
