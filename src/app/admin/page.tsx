import Link from "next/link";
import {office} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import {report} from "@/lib/report";
import {FriendTrend} from "./friend-trend";

export default async function Dashboard({searchParams}: {searchParams: Promise<{period?: string}>}) {
 await requireAdminPage(office);
 const {period = "month"} = await searchParams;
 const rows = await report(period, undefined, true);

 return <>
  <h1>ภาพรวมระบบ</h1>
  <p>ยอดเพื่อนใหม่ที่ระบบยืนยัน แยกตามพนักงานและรหัส Affiliate</p>
  <nav className="filters" aria-label="ช่วงเวลา">
   {[["day", "24 ชั่วโมง"], ["week", "7 วัน"], ["month", "30 วัน"], ["all", "ทั้งหมด"]].map(([key, label]) =>
    <Link key={key} className={period === key ? "active" : ""} href={"/admin?period=" + key}>{label}</Link>
   )}
  </nav>
  {!rows.length && <p>ยังไม่มี Affiliate</p>}
  {rows.map(row => <section className="card review" key={row.id}>
   <h2>{row.name} · {row.code}</h2>
   {!!row.employeeAccounts.length && <p>บัญชีพนักงาน {row.employeeAccounts.map(account => account.username).join(", ")}</p>}
   <p>เพื่อนใหม่ทั้งหมด <strong>{row.approved} คน</strong></p>
   <FriendTrend days={row.newFriendDays}/>
  </section>)}
 </>;
}
