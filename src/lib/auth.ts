import {redirect} from "next/navigation";
import {cookies,headers} from "next/headers";
import {readToken} from "./crypto";
import {baseUrl} from "./config";
export const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,path:"/"};
export async function admin(){const token=(await cookies()).get("admin_session")?.value??"";const s=readToken<{role:string;exp:number}>(token);if(!s||s.role!=="admin"||s.exp<Date.now())throw new Error("UNAUTHORIZED");return "admin";}
export async function sameOrigin(){if((await headers()).get("origin")!==baseUrl())throw new Error("BAD_ORIGIN");}

export async function requireAdminPage(){try{await admin();}catch{redirect("/login");}}
