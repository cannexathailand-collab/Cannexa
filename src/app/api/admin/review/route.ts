import {approvers} from "@/lib/accounts";
import {NextRequest,NextResponse} from "next/server";
import {admin,sameOrigin} from "@/lib/auth";
import {markDailyPaid} from "@/lib/commission-payment";
import {review} from "@/lib/tracking";
import {baseUrl} from "@/lib/config";
export async function POST(req:NextRequest){
 let actor:string;
 try{actor=await admin(approvers);}catch{return new Response("Unauthorized",{status:401});}await sameOrigin();const f=await req.formData();const action=String(f.get("action"));
 if(!["reject","paid","paid-day"].includes(action))return new Response("Invalid action",{status:400});
 try{if(action==="paid-day")await markDailyPaid(f.getAll("commissionId").map(String),String(f.get("reason")??""),actor);else await review(String(f.get("id")),action as "reject"|"paid",String(f.get("reason")),actor);return NextResponse.redirect(baseUrl()+"/admin/reviews",303);}
 catch(e){return new Response(e instanceof Error?e.message:"Review failed",{status:409});}
}
