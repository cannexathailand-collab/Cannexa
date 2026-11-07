import {NextResponse} from "next/server";
import {sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
import {ownerEmployeeCookie} from '@/lib/employee-view';
export async function POST(){await sameOrigin();const res=NextResponse.redirect(baseUrl()+"/login",303);res.cookies.delete("admin_session");res.cookies.delete(ownerEmployeeCookie);return res;}
