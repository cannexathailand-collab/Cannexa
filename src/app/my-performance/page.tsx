import {employeeLanguage} from '@/lib/employee-language-server';
import {loadOrderRoundSettings} from '@/lib/order-round-settings';
import Link from "next/link";
import {requireEmployeePage} from "@/lib/employee-view";
import {report} from "@/lib/report";
import {pendingCommissionThisRound,noonCommissionWindow} from '@/lib/noon-commission';
import {CommissionPanel} from './commission-panel';
import {EmployeeNav} from './employee-nav';
export default async function MyPerformance({searchParams}: {searchParams: Promise<{month?: string;kind?:string;status?:string;commissionMonth?:string;commissionPage?:string;reviewPage?:string;commissionOpen?:string}>}){
 const {t,locale,language}=await employeeLanguage();

 const a=await requireEmployeePage();
 const [r]=a.affiliateId?await report("all",a.affiliateId):[];
 const filters=await searchParams;
 const money=(n:number)=>(n/100).toLocaleString(locale,{style:'currency',currency:'THB'});
 const settings=await loadOrderRoundSettings();
 const now=new Date(),round=noonCommissionWindow(now,settings.closeMinutes),roundAmount=r?await pendingCommissionThisRound(r.id,now,settings.closeMinutes):null;
 const roundDate=(date:Date)=>date.toLocaleString(locale,{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 return <main className="center-page performance-page"><section className="customer"><h1>{t("ผลงานของฉัน")}</h1>
 <EmployeeNav active="overview"/>
 {r?<><p>{r.name} · {r.code}</p><section className="employee-noon-commission tone-income" aria-label={t("รายได้วันนี้ตามรอบปัจจุบัน")}><span>{t("รายได้วันนี้")}</span><strong>{money(roundAmount??0)}</strong><small>{t("รอบ ")}{roundDate(round.start)} – {roundDate(round.end)}</small><p>{t("เริ่มรอบแสดงผลใหม่ตามเวลาตัดรอบ ")}{settings.closeTime} {t(" น. เฉพาะค่าคอมที่คำนวณแล้วและยังไม่จ่ายในรอบนี้")}</p></section><dl>

 <dt>{t("เพื่อนใหม่")}</dt><dd>{r.approved}</dd>
 </dl><CommissionPanel affiliateId={r.id} username={a.username} filters={filters}/></>:<p>{a.role==='owner'?t('เลือกรายชื่อพนักงานด้านบนเพื่อดูข้อมูล'):t('ยังไม่ได้ผูกบัญชีกับ Affiliate')}</p>}
 <Link href="/account/password">{t("เปลี่ยนรหัสผ่าน")}</Link><form action="/api/admin/logout" method="post"><button>{t("ออกจากระบบ")}</button></form>
 </section></main>;
}
