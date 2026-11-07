import {NextRequest,NextResponse} from "next/server";
import {mockMode,baseUrl} from "@/lib/config";
import {consume} from "@/lib/oauth";
import {recordLogin,webhook} from "@/lib/tracking";
import {random,userKey,signToken} from "@/lib/crypto";
import {sameOrigin,cookieOptions} from "@/lib/auth";
export async function POST(req:NextRequest){
 if(!mockMode())return new Response("Not found",{status:404});
 await sameOrigin();const f=await req.formData();const a=await consume(String(f.get("state")??""));
 if(!a.clickId||a.purpose!=='AFFILIATE')return new Response('Invalid login purpose',{status:400});
 const scenario=String(f.get("scenario"));const identity=String(f.get("identity")??"demo-customer").slice(0,100);const key=userKey("MOCK:"+identity);
 if(scenario==="unblocked")await webhook({id:"mock-"+random(),key,type:"follow",at:new Date(),unblocked:true});
 if(scenario==="existing")await webhook({id:"mock-"+random(),key,type:"follow",at:new Date(Date.now()-86400000),unblocked:false});
 const c=await recordLogin(a.clickId,key,scenario==="outage"?null:scenario!=="not-friend",true);
 const res=NextResponse.redirect(baseUrl()+"/result",303);
 res.cookies.set("customer_result",signToken({id:c.id,exp:Date.now()+3600000}),{...cookieOptions,maxAge:3600});return res;
}
