import {NextResponse} from "next/server";
import {sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
export async function POST(){await sameOrigin();const res=NextResponse.redirect(baseUrl()+"/login",303);res.cookies.delete("admin_session");return res;}
