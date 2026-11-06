import {office} from "@/lib/accounts";
import {requireAdminPage} from "@/lib/auth";
import Link from "next/link";
import {affiliatePerformance} from "@/lib/affiliate-performance";
import {AffiliatePerformanceTable} from '@/app/affiliate-performance-table';
import '@/app/affiliate-performance.css';
export default async function Dashboard({searchParams}:{searchParams:Promise<{period?:string}>}){
 await requireAdminPage(office);const period=(await searchParams).period??"month";const rows=await affiliatePerformance(period);
 const ranked=[...rows].sort((a,b)=>b.approved-a.approved);
 const sum=(k:"clicks"|"logins"|"friends"|"approved"|"pending"|"rejected"|"totalCommissionSatang")=>rows.reduce((n,r)=>n+r[k],0);
 const max=Math.max(1,...rows.map(r=>r.approved));
 const metrics=[["Affiliate ทั้งหมด",rows.length,"คนในเครือข่าย"],["คลิกลิงก์",sum("clicks"),"จำนวนการเปิดลิงก์"],["LINE Login สำเร็จ",sum("logins"),"นับตาม Click ID ที่ Login สำเร็จ"],["เพื่อนใหม่",sum("approved"),"ระบบยืนยันจาก LINE"],["รายการที่ไม่นับค่าคอม",sum("rejected"),"เพื่อนเดิม / ปลดบล็อก / ปฏิเสธ"],["ค่าคอมรวม","฿"+(sum("totalCommissionSatang")/100).toLocaleString("th-TH"),"เพิ่มเพื่อน + ยอดขาย + พิเศษ · รอจ่ายและจ่ายแล้ว"]];
 return <><div className="intro"><div><div className="eyebrow">Performance overview</div><h1>ภาพรวม Affiliate</h1><p className="muted">ติดตามผลการแนะนำ และตรวจสอบทุกยอดก่อนจ่ายค่าคอมมิชชัน</p></div><a className="button secondary" href={"/api/admin/export?period="+period}>↓ ส่งออก CSV</a></div><div className="filters" style={{marginBottom:22}}>{[["day","24 ชั่วโมง"],["week","7 วัน"],["month","30 วัน"],["all","ทั้งหมด"]].map(([k,t])=><Link className={period===k?"active":""} key={k} href={"/admin?period="+k}>{t}</Link>)}</div><section className="stats">{metrics.map(([label,value,note])=><article className="card stat" key={label}><span>{label}</span><strong>{value}</strong><span>{note}</span></article>)}</section>
<section className="card review">
   <h2>อันดับเพื่อนใหม่ตามพนักงาน</h2>
   {!rows.length && <p>ยังไม่มี Affiliate</p>}
   <div className="table-wrap"><table>
    <thead><tr><th>อันดับ</th><th>พนักงาน / Affiliate</th><th>เปรียบเทียบ</th><th>เพื่อนใหม่</th></tr></thead>
    <tbody>{ranked.map((row, index) => <tr key={row.id}>
     <td>{index + 1}</td>
     <th scope="row">{row.name} · {row.code}
      {!!row.employeeAccounts.length && <><br/>{row.employeeAccounts.map(account => account.username).join(", ")}</>}
     </th>
     <td style={{width:"45%"}}><div className="track" aria-hidden="true"><div className="bar" style={{width: (row.approved / max * 100) + "%"}}/></div></td>
     <td>{row.approved} คน</td>
    </tr>)}</tbody>
   </table></div>
  </section>
<div className="columns"><section className="card"><h2>เพื่อนใหม่แยกตาม Affiliate</h2><p className="muted small">เฉพาะรายการที่ระบบยืนยันจาก LINE</p>{rows.length?rows.map(r=><div className="chart-row" key={r.id}><span>{r.name}</span><div className="track"><div className="bar" style={{width:(r.approved/max*100)+"%"}} /></div><strong>{r.approved} คน</strong></div>):<p className="empty">เพิ่ม Affiliate เพื่อเริ่มติดตามผล</p>}</section></div><AffiliatePerformanceTable rows={rows}/></>;
}
