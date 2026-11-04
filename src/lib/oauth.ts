import {cookies} from "next/headers";
import {sha,equal} from "./crypto";
import {db} from "./db";
export async function consume(state:string){
 if(!/^[A-Za-z0-9_-]{40,100}$/.test(state))throw new Error("Invalid state");
 const browser=(await cookies()).get("oauth_"+sha(state).slice(0,16))?.value;
 const attempt=await db.oAuthAttempt.findUnique({where:{stateHash:sha(state)}});
 if(!browser||!attempt||!equal(sha(browser),attempt.browserHash)||attempt.consumedAt||attempt.expiresAt<new Date())throw new Error("Invalid/expired OAuth session");
 const claimed=await db.oAuthAttempt.updateMany({where:{id:attempt.id,consumedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});
 if(claimed.count!==1)throw new Error("OAuth replay");
 return attempt;
}
