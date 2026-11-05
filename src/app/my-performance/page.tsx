import Link from "next/link";
import {requireAdminPage} from "@/lib/auth";
import {commissionReport} from "@/lib/commission-report";


import {CommissionMonthSelect} from "@/app/commission-month-select";
import {report} from "@/lib/report";
export default async function MyPerformance({searchParams}: {searchParams: Promise<{month?: string}>}){
 const a=await requireAdminPage(["employee"]);
 const [r]=a.affiliateId?await report("all",a.affiliateId):[];
 const requestedMonth=(await searchParams).month;
 const result=r?await commissionReport(requestedMonth,r.id):null;
 const month=result?.month??"",months=result?.months??[],entries=result?.groups.get(r?.id??"")??[];
 const amount = (status: "Approved" | "Paid") => entries.reduce((sum, row) => sum + (row.status === status ? row.amountSatang : 0), 0) / 100;
 return <main className="center-page"><section className="customer"><h1>ผลงานของฉัน</h1>
 {r?<><p>{r.name} · {r.code}</p><dl>

 <dt>เพื่อนใหม่</dt><dd>{r.approved}</dd>
 </dl><CommissionMonthSelect action="/my-performance" month={month} months={months}/><dl>
 <dt>รอจ่าย</dt><dd>฿{amount("Approved").toFixed(2)}</dd>
 <dt>จ่ายแล้ว</dt><dd>฿{amount("Paid").toFixed(2)}</dd></dl></>:<p>ยังไม่ได้ผูกบัญชีกับ Affiliate</p>}
 <Link href="/account/password">เปลี่ยนรหัสผ่าน</Link><form action="/api/admin/logout" method="post"><button>ออกจากระบบ</button></form>
 </section></main>;
}
