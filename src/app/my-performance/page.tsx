import Link from "next/link";
import {requireAdminPage} from "@/lib/auth";
import {report} from "@/lib/report";
export default async function MyPerformance(){
 const a=await requireAdminPage(["employee"]);
 const [r]=a.affiliateId?await report("all",a.affiliateId):[];
 return <main className="center-page"><section className="customer"><h1>ผลงานของฉัน</h1>
 {r?<><p>{r.name} · {r.code}</p><dl>

 <dt>เพื่อนใหม่</dt><dd>{r.approved}</dd>
 <dt>รอจ่าย</dt><dd>฿{((r.commissionSatang-r.paidSatang)/100).toFixed(2)}</dd>
 <dt>จ่ายแล้ว</dt><dd>฿{(r.paidSatang/100).toFixed(2)}</dd></dl></>:<p>ยังไม่ได้ผูกบัญชีกับ Affiliate</p>}
 <Link href="/account/password">เปลี่ยนรหัสผ่าน</Link><form action="/api/admin/logout" method="post"><button>ออกจากระบบ</button></form>
 </section></main>;
}
