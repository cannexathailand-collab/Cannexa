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
  url.searchParams.set("status", await sendMetaTest());
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
