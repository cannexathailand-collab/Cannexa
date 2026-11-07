import {redirect} from "next/navigation";
import {cookies,headers} from "next/headers";
import {readToken} from "./crypto";
import {baseUrl} from "./config";
import {account,home,type Role} from "./accounts";
export const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/"};
export async function currentAccount(){
 const token=(await cookies()).get("admin_session")?.value??"";
 const s=readToken<{role:string;username?:string;version?:string;exp:number}>(token);
 if(!s||s.exp<=Date.now())throw new Error("UNAUTHORIZED");
 const username=s.username??(s.role==="admin"?"owner":"");
 const a=await account(username);
 if(!a?.active||a.version!==(s.version??"initial"))throw new Error("UNAUTHORIZED");
 return a;
}
export async function admin(allowed:Role[]=["owner"]){
 const a=await currentAccount();
 if(a.role!=="owner"&&!allowed.includes(a.role as Role))throw new Error("FORBIDDEN");
 return a.username;
}
export async function sameOrigin(){if((await headers()).get("origin")!==baseUrl())throw new Error("BAD_ORIGIN");}
export async function requireAccount(){
 try{return await currentAccount();}
 catch(error){
  if(error instanceof Error&&error.message==='UNAUTHORIZED')redirect('/login');
  // A transient database failure is not evidence that a valid session expired.
  throw error;
 }
}
export async function requireAdminPage(allowed:Role[]=["owner"]){
 const a=await requireAccount();
 if(a.role!=="owner"&&!allowed.includes(a.role as Role))redirect(a.role==="employee"?home(a.role):"/admin");
 return a;
}
