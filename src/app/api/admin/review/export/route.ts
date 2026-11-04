import {approvers} from "@/lib/accounts";
import {admin} from "@/lib/auth";
import {commissionReport} from "@/lib/commission-report";
import {csvCell} from "@/lib/policy";

export async function GET(req: Request) {
 try { await admin(approvers); } catch { return new Response("Unauthorized", {status: 401}); }
 const {affiliates, groups, month} = await commissionReport(new URL(req.url).searchParams.get("month") ?? undefined);
 const rows = affiliates.map(({id, name, code, accounts}) => {
  const entries = groups.get(id) ?? [];
  const total = (status: "Approved" | "Paid") =>
   (entries.reduce((sum, item) => sum + (item.status === status ? item.amountSatang : 0), 0) / 100).toFixed(2);
  return [month, name, code, accounts.map(account => account.username).join(", "), total("Approved"), total("Paid")];
 });
 const header = ["เดือน", "ชื่อ Affiliate", "รหัส Affiliate", "บัญชีพนักงาน", "ยังไม่ได้จ่าย (บาท)", "จ่ายแล้วสะสม (บาท)"];
 const csv = [header, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
 return new Response("\uFEFF"+csv, {headers: {
  "Content-Type": "text/csv; charset=utf-8",
  "Content-Disposition": `attachment; filename="commission-${month}.csv"`,
  "Cache-Control": "private, no-store",
 }});
}
