import {office} from "@/lib/accounts";
import {admin} from "@/lib/auth";
import {affiliatePerformance} from "@/lib/affiliate-performance";
import {csvCell} from "@/lib/policy";
export async function GET(req:Request){try{await admin(office);}catch{return new Response("Unauthorized",{status:401});}const rows=await affiliatePerformance(new URL(req.url).searchParams.get("period")??"all");const keys=["code","name","clicks","logins","approved","rejected","commissionSatang","referredCount","referredRevenueSatang","closedCount","closedRevenueSatang","pendingSalesSatang","paidSalesSatang","pendingCommissionSatang","paidCommissionSatang","totalCommissionSatang","specialCommissionSatang"] as const;const csv=[keys.join(","),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(","))].join("\r\n");return new Response("\uFEFF"+csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="affiliates.csv"'}});}
