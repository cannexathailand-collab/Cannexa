import {employeeLanguage} from '@/lib/employee-language-server';
import {referredSalesReport} from '@/lib/referred-sales';
import {requireEmployeePage} from '@/lib/employee-view';
import {commissionReport} from '@/lib/commission-report';
import {salesReport} from '@/lib/sales-report';
import {CommissionMonthSelect} from '@/app/commission-month-select';
import {EmployeeNav} from '../employee-nav';
export default async function EmployeeMonthly({searchParams}:{searchParams:Promise<{month?:string}>}){
 const {t,locale,language}=await employeeLanguage();

 const a=await requireEmployeePage();
 if(!a.affiliateId)return <main className="center-page performance-page"><section className="customer"><h1>{t("สรุปผลงานรายเดือน")}</h1><EmployeeNav active="monthly"/><p>{a.role==='owner'?t('เลือกรายชื่อพนักงานด้านบนเพื่อดูข้อมูล'):t('ยังไม่ได้ผูกบัญชีกับ Affiliate')}</p></section></main>;
 const {month:requested}=await searchParams;
 const result=await commissionReport(requested,a.affiliateId),entries=result.groups.get(a.affiliateId)??[];
 const [closed,referred]=await Promise.all([salesReport({month:result.month,seller:a.username}),referredSalesReport(result.month,a.affiliateId)]);
 const money=(n:number)=>(n/100).toLocaleString(locale,{style:'currency',currency:'THB'});
 const amount=(status:'Approved'|'Paid')=>entries.filter(r=>r.status===status).reduce((n,r)=>n+r.amountSatang,0);
 return <main className="center-page performance-page"><section className="customer">
  <h1>{t("สรุปผลงานรายเดือน")}</h1><p className="muted">{a.username} {t(" · เลือกเดือนเพื่อดูผลงานและค่าคอมของคุณ")}</p><EmployeeNav active="monthly"/>
  <CommissionMonthSelect locale={locale} action="/my-performance/monthly" month={result.month} months={result.months} label={t("เดือนที่ต้องการดู")}/>
  <section className="commission-summary-grid" aria-label={t("ค่าคอมประจำเดือน")}>
   <article className="commission-metric"><span>{t("ค่าคอมรอจ่ายของเดือนที่เลือก")}</span><strong>{money(amount('Approved'))}</strong><small>{t("ค่าคอมที่คำนวณแล้วและยังไม่จ่าย")}</small></article>
   <article className="commission-metric"><span>{t("ค่าคอมจ่ายแล้วของเดือนที่เลือก")}</span><strong>{money(amount('Paid'))}</strong><small>{t("ยอดจ่ายของรายการในเดือนที่เลือก")}</small></article>
  </section>
  <section className="commission-monthly"><h2>{t("ยอดขายและผลงานของฉัน")}</h2><div className="commission-summary-grid">
   <article className="commission-metric"><span>{t("ยอดขายที่ฉันปิดการขาย")}</span><strong>{money(closed.summary.revenueSatang)}</strong><small>{closed.summary.count.toLocaleString(locale)} {t(" ออเดอร์")}</small></article>
   <article className="commission-metric"><span>{t("ยอดขายจากลูกค้าที่มีหลักฐานแนะนำ")}</span><strong>{money(referred.summary.revenueSatang)}</strong><small>{referred.summary.count.toLocaleString(locale)} {t(" ออเดอร์")}</small></article>
   <article className="commission-metric"><span>{t("ลูกค้าที่มีหลักฐานแนะนำและซื้อในเดือนนี้")}</span><strong>{new Set(referred.summary.rows.flatMap(s=>s.customer?[s.customer.code]:[])).size.toLocaleString(locale)} <em>{t("คน")}</em></strong></article>
  </div><p className="small muted">{t("ยอดแนะนำอ้างอิงลูกค้าที่เข้าผ่านลิงก์แนะนำหรือลงทะเบียนพร้อมผู้แนะนำ · เฉพาะยอดขายที่ยืนยันแล้วของเดือนที่เลือก ยอดขายสองมุมอาจเป็นออเดอร์เดียวกัน จึงไม่ใช้บวกเป็นยอดรวมร้าน")}</p></section>
 </section></main>;
}
