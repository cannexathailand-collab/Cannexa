import {db} from "@/lib/db";
import {equal} from "@/lib/crypto";
import {enableGmailWatch} from "@/lib/gmail-push";
export const maxDuration=60;
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;if(!secret||secret.length<32)return new Response("Cron not configured",{status:503});
 if(!equal(req.headers.get("authorization")??"","Bearer "+secret))return new Response("Forbidden",{status:403});
 const connection=await db.gmailConnection.findUnique({where:{id:"active"},select:{topicName:true,encryptedToken:true}});if(!connection?.encryptedToken||!connection.topicName)return Response.json({skipped:true});
 try{await enableGmailWatch(connection.topicName,"gmail-renewal");return Response.json({ok:true});}catch{return new Response("Renewal failed",{status:503});}
}
