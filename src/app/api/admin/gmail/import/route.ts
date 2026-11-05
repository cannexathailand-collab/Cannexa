import {NextResponse} from "next/server";
import {admin,sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
import {importGmailReports,matchShipments} from "@/lib/gmail-reports";
export const maxDuration=60;
export async function POST(){
 let actor:string;try{actor=await admin();await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 try{const result=await importGmailReports(actor);const matches=await matchShipments(actor);const params=new URLSearchParams({status:"imported",files:String(result.imported),matched:String(matches.matched),more:String(result.hasMore)});return NextResponse.redirect(baseUrl()+"/admin/gmail?"+params,303);}
 catch(e){const known=["GMAIL_RECONNECT","SHIPMENT_CONFLICT","COD_CONFLICT","UNSUPPORTED_REPORT","UNSUPPORTED_COLUMNS"];const reason=e instanceof Error&&known.includes(e.message)?e.message:"IMPORT_FAILED";return NextResponse.redirect(baseUrl()+"/admin/gmail?status="+reason,303);}
}
