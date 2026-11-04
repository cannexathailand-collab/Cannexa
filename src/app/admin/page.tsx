import Link from "next/link";
import {office} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import {report} from "@/lib/report";


export default async function Dashboard({searchParams}: {searchParams: Promise<{period?: string}>}) {
 await requireAdminPage(office);
 const {period = "month"} = await searchParams;
 const rows = (await report(period, undefined, true)).sort((a, b) => b.approved - a.approved);
 const max = Math.max(1, rows[0]?.approved ?? 0);

 return <>
  <h1>ภาพรวมระบบ</h1>
  <p>ยอดเพื่อนใหม่ที่ระบบยืนยัน แยกตามพนักงานและรหัส Affiliate</p>
  <nav className="filters" aria-label="ช่วงเวลา">
   {[["day", "24 ชั่วโมง"], ["week", "7 วัน"], ["month", "30 วัน"], ["all", "ทั้งหมด"]].map(([key, label]) =>
    <Link key={key} className={period === key ? "active" : ""} href={"/admin?period=" + key}>{label}</Link>
   )}
  </nav>
  <section className="card review">
   <h2>อันดับเพื่อนใหม่ตามพนักงาน</h2>
   {!rows.length && <p>ยังไม่มี Affiliate</p>}
   <div className="table-wrap"><table>
    <thead><tr><th>อันดับ</th><th>พนักงาน / Affiliate</th><th>เปรียบเทียบ</th><th>เพื่อนใหม่</th></tr></thead>
    <tbody>{rows.map((row, index) => <tr key={row.id}>
     <td>{index + 1}</td>
     <th scope="row">{row.name} · {row.code}
      {!!row.employeeAccounts.length && <><br/>{row.employeeAccounts.map(account => account.username).join(", ")}</>}
     </th>
     <td style={{width:"45%"}}><div className="track" aria-hidden="true"><div className="bar" style={{width: (row.approved / max * 100) + "%"}}/></div></td>
     <td>{row.approved} คน</td>
    </tr>)}</tbody>
   </table></div>
  </section>
 </>;
}
