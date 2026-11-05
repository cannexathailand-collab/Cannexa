import {NextResponse} from "next/server";
import {admin, sameOrigin} from "@/lib/auth";
import {baseUrl} from "@/lib/config";
import {transaction} from "@/lib/db";
import {metaAdCode} from "@/lib/meta-ad";

export async function POST(req: Request) {
 let actor: string;
 try { actor = await admin(); await sameOrigin(); }
 catch { return new Response("Forbidden", {status: 403}); }
 const form = await req.formData();
 const id = String(form.get("id") ?? "");
 if (!id || form.get("confirm") !== "yes") return new Response("Confirmation required", {status: 400});
 await transaction(async tx => {
  const changed = await tx.affiliate.updateMany({
   where: {id, archivedAt: null, code: {not: metaAdCode}},
   data: {active: false, archivedAt: new Date()},
  });
  if (changed.count) await tx.auditLog.create({data: {
   actor, action: "AFFILIATE_LINK_DELETED", entityId: id, details: {},
  }});
 });
 return NextResponse.redirect(baseUrl() + "/admin/affiliates", 303);
}
