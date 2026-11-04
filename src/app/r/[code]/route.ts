import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
import {sha,random} from "@/lib/crypto";
import {baseUrl,mockMode} from "@/lib/config";
import {authorizationUrl} from "@/lib/line";
import {cookieOptions} from "@/lib/auth";
import {limit} from "@/lib/rate-limit";
export async function GET(req:NextRequest,{params}:{params:Promise<{code:string}>}){
 const {code}=await params;
 const link=await db.trackingLink.findFirst({where:{affiliate:{code,active:true}},include:{affiliate:true}});
 if(!link)return new Response("ไม่พบลิงก์ หรือ Affiliate ถูกระงับ",{status:404});
 if(!await limit("tracking:"+link.id,5000))return new Response("ลองใหม่ภายหลัง",{status:429});
 const state=random(),browser=random(),verifier=random(),nonce=random();
 const click=await db.click.create({data:{affiliateId:link.affiliateId,linkId:link.id,source:mockMode()?"MOCK":"LINE",oauth:{create:{stateHash:sha(state),browserHash:sha(browser),verifier,nonce,expiresAt:new Date(Date.now()+600000)}}}});
 const target=mockMode()?baseUrl()+"/mock?state="+state:authorizationUrl(state,nonce,verifier);
 const res=NextResponse.redirect(target);
 res.cookies.set("oauth_"+sha(state).slice(0,16),browser,{...cookieOptions,maxAge:600});
 return res;
}
