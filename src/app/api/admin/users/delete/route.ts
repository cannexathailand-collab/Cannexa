import {NextResponse} from "next/server";
import {admin, sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
import {deleteEmployee} from "@/lib/delete-employee";

export async function POST(req: Request) {
 let actor: string;
 try {
  actor = await admin();
  await sameOrigin();
 } catch {
  return new Response("Forbidden", {status: 403});
 }
 const form = await req.formData();
 if (form.get("confirm") !== "yes") return new Response("Confirmation required", {status: 400});
 try {
  await deleteEmployee(String(form.get("username") ?? ""), actor);
  return NextResponse.redirect(baseUrl() + "/admin/users?status=deleted", 303);
 } catch {
  return NextResponse.redirect(baseUrl() + "/admin/users?status=delete-error", 303);
 }
}
