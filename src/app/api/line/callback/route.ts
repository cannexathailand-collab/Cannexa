import {NextRequest,NextResponse} from "next/server";
import {consume} from "@/lib/oauth";
import {exchange} from "@/lib/line";
import {recordLogin} from "@/lib/tracking";
import {userKey,sha} from "@/lib/crypto";
import {baseUrl,mockMode} from "@/lib/config";
import {db} from "@/lib/db";
import {syncLoginCustomer} from '@/lib/customer-code-message';
import {lineSettings} from "@/lib/line-settings";
import {lineCustomerDestination} from "@/lib/line-customer-destination";
export async function GET(req:NextRequest){
 if(mockMode())return new Response("Real callback disabled in mock mode",{status:409});
 let clickId:string|undefined;
 const state=req.nextUrl.searchParams.get("state")??"";
 try{
  const a=await consume(state);clickId=a.clickId;
  if(req.nextUrl.searchParams.has("error"))throw new Error("Login declined");
  const code=req.nextUrl.searchParams.get("code");if(!code)throw new Error("Missing code");
  const connection=await lineSettings();
  if(!connection||connection.revision!==(a.lineRevision??"environment"))throw new Error("LINE configuration changed");
  const result=await exchange(code,a.verifier,a.nonce,connection.settings);
  const changed=req.nextUrl.searchParams.get("friendship_status_changed");
  const key=userKey(connection.settings.botId===process.env.LINE_BOT_USER_ID?result.userId:connection.settings.botId+":"+result.userId);
  const customer=await recordLogin(a.clickId,key,result.friendFlag,changed==="true"?true:changed==="false"?false:null);
  const originalClick=await db.click.findUniqueOrThrow({where:{id:customer.clickId}});
  await syncLoginCustomer(key,customer,originalClick.metaFbc);
  const res=NextResponse.redirect(lineCustomerDestination(connection.settings.basicId,result.friendFlag));
  res.cookies.set('customer_result','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/result',maxAge:0});
  res.cookies.delete("oauth_"+sha(state).slice(0,16));return res;
 }catch{
  if(clickId)await db.click.update({where:{id:clickId},data:{loginResult:"FAILED"}});
  return NextResponse.redirect(baseUrl()+"/result?error=1");
 }
}
