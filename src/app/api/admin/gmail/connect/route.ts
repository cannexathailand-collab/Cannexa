import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {admin,currentAccount,sameOrigin,cookieOptions} from "@/lib/auth";
import {db} from "@/lib/db";
import {baseUrl} from "@/lib/config";
import {random,sha,challenge} from "@/lib/crypto";
import {decryptGmail,gmailAuthorization,type GmailConfig} from "@/lib/gmail";
export async function POST(){
 try{await admin();await sameOrigin();}catch{return new Response("Forbidden",{status:403});}
 const actor=await currentAccount(),connection=await db.gmailConnection.findUnique({where:{id:"active"}});if(!connection)return NextResponse.redirect(baseUrl()+"/admin/gmail?status=not-configured",303);
 const state=random(),browser=random(),verifier=random();
 await db.gmailOAuthAttempt.create({data:{stateHash:sha(state),browserHash:sha(browser),actor:actor.username,actorVersion:actor.version,revision:connection.revision,verifier,expiresAt:new Date(Date.now()+600000)}});
 (await cookies()).set("gmail_oauth",browser,{...cookieOptions,maxAge:600});
 return NextResponse.redirect(gmailAuthorization(decryptGmail<GmailConfig>(connection.encryptedConfig),state,challenge(verifier)),303);
}
