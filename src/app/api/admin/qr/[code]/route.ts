import {managers} from "@/lib/accounts";
import {admin} from "@/lib/auth";
import {db} from "@/lib/db";
import {baseUrl} from "@/lib/config";
import QRCode from "qrcode";
export async function GET(_req:Request,{params}:{params:Promise<{code:string}>}){
 try{await admin(managers);}catch{return new Response("Unauthorized",{status:401});}const {code}=await params;
 const affiliate=await db.affiliate.findUnique({where:{code}});if(!affiliate||affiliate.archivedAt)return new Response("Not found",{status:404});
 const png=await QRCode.toBuffer(baseUrl()+"/r/"+encodeURIComponent(code),{width:1000,margin:4,errorCorrectionLevel:"M"});
 return new Response(new Uint8Array(png),{headers:{"Content-Type":"image/png","Content-Disposition":'attachment; filename="'+code+'.png"'}});
}
