import {requireAdminPage} from '@/lib/auth';
import {commissionReport} from '@/lib/commission-report';
import {salesReport} from '@/lib/sales-report';
import {CommissionMonthSelect} from '@/app/commission-month-select';
import {EmployeeNav} from '../employee-nav';
export default async function EmployeeMonthly({searchParams}:{searchParams:Promise<{month?:string}>}){
 const a=await requireAdminPage(['employee']);
 if(!a.affiliateId)return <main className="center-page performance-page"><section className="customer"><h1>สรุปผลงานรายเดือน</h1><EmployeeNav active="monthly"/><p>ยังไม่ได้ผูกบัญชีกับ Affiliate</p></section></main>;
 const {month:requested}=await searchParams;
 const result=await commissionReport(requested,a.affiliateId),entries=result.groups.get(a.affiliateId)??[];
 const [closed,referred]=await Promise.all([salesReport({month:result.month,seller:a.username}),salesReport({month:result.month,affiliateId:a.affiliateId})]);
 const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
 const amount=(status:'Approved'|'Paid')=>entries.filter(r=>r.status===status).reduce((n,r)=>n+r.amountSatang,0);
 return <main className="center-page performance-page"><section className="customer">
  <h1>สรุปผลงานรายเดือน</h1><p className="muted">{a.username} · เลือกเดือนเพื่อดูผลงานและค่าคอมของคุณ</p><EmployeeNav active="monthly"/>
  <CommissionMonthSelect action="/my-performance/monthly" month={result.month} months={result.months} label="เดือนที่ต้องการดู"/>
  <section className="commission-summary-grid" aria-label="ค่าคอมประจำเดือน">
   <article className="commission-metric"><span>ค่าคอมรอจ่ายของเดือนที่เลือก</span><strong>{money(amount('Approved'))}</strong><small>ค่าคอมที่คำนวณแล้วและยังไม่จ่าย</small></article>
   <article className="commission-metric"><span>ค่าคอมจ่ายแล้วของเดือนที่เลือก</span><strong>{money(amount('Paid'))}</strong><small>ยอดจ่ายของรายการในเดือนที่เลือก</small></article>
  </section>
  <section className="commission-monthly"><h2>ยอดขายและผลงานของฉัน</h2><div className="commission-summary-grid">
   <article className="commission-metric"><span>ยอดขายที่ฉันปิดการขาย</span><strong>{money(closed.summary.revenueSatang)}</strong><small>{closed.summary.count.toLocaleString('th-TH')} ออเดอร์</small></article>
   <article className="commission-metric"><span>ยอดขายจากลูกค้าที่ฉันแนะนำ</span><strong>{money(referred.summary.revenueSatang)}</strong><small>{referred.summary.count.toLocaleString('th-TH')} ออเดอร์</small></article>
   <article className="commission-metric"><span>ลูกค้าที่แนะนำและซื้อในเดือนนี้</span><strong>{new Set(referred.summary.rows.flatMap(s=>s.customer?[s.customer.code]:[])).size.toLocaleString('th-TH')} <em>คน</em></strong></article>
  </div><p className="small muted">เฉพาะยอดขายที่ยืนยันแล้วของเดือนที่เลือก ยอดขายสองมุมอาจเป็นออเดอร์เดียวกัน จึงไม่ใช้บวกเป็นยอดรวมร้าน</p></section>
 </section></main>;
}
