import Link from "next/link";
import {requireEmployeePage} from "@/lib/employee-view";
import {report} from "@/lib/report";
import {pendingCommissionThisRound,noonCommissionWindow} from '@/lib/noon-commission';
import {CommissionPanel} from './commission-panel';
import {EmployeeNav} from './employee-nav';
export default async function MyPerformance({searchParams}: {searchParams: Promise<{month?: string;kind?:string;status?:string;commissionMonth?:string;commissionPage?:string;reviewPage?:string;commissionOpen?:string}>}){
 const a=await requireEmployeePage();
 const [r]=a.affiliateId?await report("all",a.affiliateId):[];
 const filters=await searchParams;
 const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
 const now=new Date(),round=noonCommissionWindow(now),roundAmount=r?await pendingCommissionThisRound(r.id,now):null;
 const roundDate=(date:Date)=>date.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 return <main className="center-page performance-page"><section className="customer"><h1>ผลงานของฉัน</h1>
 <EmployeeNav active="overview"/>
 {r?<><p>{r.name} · {r.code}</p><section className="employee-noon-commission" aria-label="ค่าคอมรอรับสะสมรอบปัจจุบัน"><span>ค่าคอมรอรับสะสม</span><strong>{money(roundAmount??0)}</strong><small>รอบ {roundDate(round.start)} – {roundDate(round.end)}</small><p>เริ่มรอบแสดงผลใหม่ทุกเที่ยง เฉพาะค่าคอมที่คำนวณแล้วและยังไม่จ่ายในรอบนี้</p></section><dl>

 <dt>เพื่อนใหม่</dt><dd>{r.approved}</dd>
 </dl><CommissionPanel affiliateId={r.id} username={a.username} filters={filters}/></>:<p>{a.role==='owner'?'เลือกรายชื่อพนักงานด้านบนเพื่อดูข้อมูล':'ยังไม่ได้ผูกบัญชีกับ Affiliate'}</p>}
 <Link href="/account/password">เปลี่ยนรหัสผ่าน</Link><form action="/api/admin/logout" method="post"><button>ออกจากระบบ</button></form>
 </section></main>;
}
