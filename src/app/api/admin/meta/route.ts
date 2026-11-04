import {NextResponse} from "next/server";
import {admin, sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
import {db} from "@/lib/db";
import {metaDatasetPattern, sendMetaTest} from "@/lib/meta";

export async function POST(req: Request) {
 try { await admin(["owner"]); } catch { return new Response("Unauthorized", {status: 401}); }
 await sameOrigin();
 const form = await req.formData();
 const datasetId = String(form.get("datasetId") ?? "").trim();
 const url = new URL("/admin/meta", baseUrl());
 if (form.get("action") === "test") {
  const result = await sendMetaTest();
  url.searchParams.set("status", result.status);
  if(result.sentAt) url.searchParams.set("sentAt", result.sentAt);
  if(result.trace) url.searchParams.set("trace", result.trace);
  if(result.http) url.searchParams.set("http", result.http);
 } else if (!metaDatasetPattern.test(datasetId)) {
  url.searchParams.set("status", "invalid");
 } else {
  await db.metaConnection.upsert({
   where: {id: "default"}, create: {id: "default", datasetId}, update: {datasetId},
  });
  url.searchParams.set("status", "saved");
 }
 return NextResponse.redirect(url, 303);
}
