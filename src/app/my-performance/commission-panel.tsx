import {employeeLanguage} from '@/lib/employee-language-server';
import Link from 'next/link';
import {employeeCommissions,commissionKinds} from '@/lib/employee-commissions';
import {commissionMonth} from '@/lib/commission-month';
import {employeeReviewOrders} from '@/lib/employee-review-orders';
import {CommissionDialog} from './commission-dialog';
type Filters={kind?:string;status?:string;commissionMonth?:string;commissionPage?:string;month?:string;reviewPage?:string;commissionOpen?:string};
const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
const date=(d:Date)=>d.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'2-digit'});
const statuses={PENDING:'รอจ่าย',PAID:'จ่ายแล้ว',WAITING:'รอคำนวณ / ตรวจสอบ'};
export async function CommissionPanel({affiliateId,username,filters}:{affiliateId:string;username:string;filters:Filters}){
 const {t,locale,language}=await employeeLanguage();
 const money=(n:number)=>(n/100).toLocaleString(locale,{style:'currency',currency:'THB'});
 const date=(d:Date)=>d.toLocaleDateString(locale,{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'2-digit'});


 const [data,reviews]=await Promise.all([employeeCommissions(affiliateId),employeeReviewOrders(affiliateId,username)]);
 const kind=filters.kind&&Object.hasOwn(commissionKinds,filters.kind)?filters.kind:'ALL';
 const status=filters.status&&Object.hasOwn(statuses,filters.status)?filters.status:'ALL';
 const months=[...new Set(data.rows.map(r=>commissionMonth(r.date)))].sort().reverse();
 const month=months.includes(filters.commissionMonth??'')?filters.commissionMonth!:'ALL';
 const filtered=data.rows.filter(r=>(kind==='ALL'||r.kind===kind)&&(status==='ALL'||r.status===status)&&(month==='ALL'||commissionMonth(r.date)===month));
 const pages=Math.max(1,Math.ceil(filtered.length/25)),page=Math.min(pages,Math.max(1,Number.parseInt(filters.commissionPage??'1',10)||1));
 const rows=filtered.slice((page-1)*25,page*25);
 const href=(values:Partial<Filters>)=>'/my-performance?'+new URLSearchParams(Object.entries({...filters,kind,status,commissionMonth:month,commissionPage:'1',commissionOpen:'1',...values}).filter(([,v])=>v!==undefined) as [string,string][]).toString();
 return <section className="employee-commissions" aria-label={t("รายละเอียดค่าคอมมิชชัน")}>
  {reviews.length>0&&<div className="employee-task-alert" role="status"><div><strong>{t("มีงานค้าง ")}{reviews.length} {t(" ออเดอร์ที่ต้องติดตาม")}</strong><p>{t("รวมรายการค้างจากเดือนก่อน เปิดดูสาเหตุและสิ่งที่ต้องทำต่อ")}</p></div><Link href="/my-performance/tasks">{t("ดูงานค้าง →")}</Link></div>}
  <div className="commission-summary-grid">
   <article className="commission-metric tone-income"><span>{t("ค่าคอมรอจ่ายทั้งหมด")}</span><strong>{money(data.pending)}</strong><small>{t("ทุกรอบที่คำนวณแล้วและยังไม่จ่าย")}</small></article>
   <article className="commission-metric"><span>{t("ค่าคอมจ่ายแล้วทั้งหมด")}</span><strong>{money(data.paid)}</strong><small>{t("รวมค่าคอมพิเศษที่บันทึกจ่ายแล้ว")}</small></article>
   <article className="commission-metric"><span>{t("รอคำนวณ / ตรวจสอบ")}</span><strong>{data.waiting.toLocaleString(locale)} <em>{t("รายการ")}</em></strong><small>{t("ยังไม่รวมในยอดรอจ่าย")}</small></article>
   <a className="commission-metric review-metric" href="#employee-review-orders"><span>{t("รายการต้องตรวจสอบ")}</span><strong>{reviews.length.toLocaleString(locale)} <em>{t("ออเดอร์")}</em></strong><small>{t("ดูเหตุผลและเปิดตรวจสอบออเดอร์ →")}</small></a>
  </div>
  <div className="commission-section-title"><h2>{t("ค่าคอมแต่ละประเภท")}</h2><p>{t("ยอดรวมตลอดทั้งหมด แยกรอจ่ายและจ่ายแล้ว")}</p></div>
  <div className="commission-category-grid">{data.categories.map(c=><article className="commission-category tone-income" key={c.kind}>
   <h3>{t(commissionKinds[c.kind])}</h3><span>{t("รอจ่าย")}</span><strong>{money(c.pending)}</strong><p>{t("จ่ายแล้ว ")}<b>{money(c.paid)}</b></p><small>{c.waiting?`${t('รอคำนวณ / ตรวจสอบ')} ${c.waiting} ${t('รายการ')}`:`${t('ทั้งหมด')} ${c.count} ${t('รายการ')}`}</small>
   <Link href={href({kind:c.kind,status:'ALL',commissionMonth:'ALL'})}>{t("ดูรายละเอียด ")}<span aria-hidden="true">→</span></Link>
  </article>)}</div>
  <CommissionDialog autoOpen={filters.commissionOpen==='1'}>
  <section id="commission-details" className="commission-details">
   <div className="commission-section-title"><p>{filtered.length.toLocaleString(locale)} {t(" รายการ · วันที่รายการและวันที่จ่ายแสดงแยกกัน")}</p></div>
   <form method="get" action="/my-performance" className="commission-filters">
    <input type="hidden" name="commissionOpen" value="1"/>
    {filters.month&&<input type="hidden" name="month" value={filters.month}/>}
    <label>{t("ประเภท")}<select name="kind" defaultValue={kind}>{[['ALL','ทุกประเภท'],...Object.entries(commissionKinds)].map(([v,label])=><option value={v} key={v}>{t(label)}</option>)}</select></label>
    <label>{t("สถานะ")}<select name="status" defaultValue={status}>{[['ALL','ทุกสถานะ'],...Object.entries(statuses)].map(([v,label])=><option value={v} key={v}>{t(label)}</option>)}</select></label>
    <label>{t("เดือนของรายการ")}<select name="commissionMonth" defaultValue={month}><option value="ALL">{t("ทุกเดือน")}</option>{months.map(m=><option value={m} key={m}>{new Date(m+'-01T00:00:00+07:00').toLocaleDateString(locale,{timeZone:'Asia/Bangkok',month:'long',year:'numeric'})}</option>)}</select></label>
    <button type="submit">{t("แสดงรายการ")}</button>
   </form>
   <div className="commission-rows">{rows.length?rows.map(r=><article className="commission-row" key={r.id}>
    <div><span className="commission-kind">{t(commissionKinds[r.kind])}</span><h3>{r.reference}</h3><p>{r.note}</p><small>{t("วันที่รายการ ")}{date(r.date)}{r.paidAt?` · ${t('จ่ายเมื่อ')} ${date(r.paidAt)}`:''}</small></div>
    <div className="commission-row-amount"><strong>{r.amount===null?t('รอคำนวณ'):money(r.amount)}</strong><span className={'commission-status '+r.status.toLowerCase()}>{t(statuses[r.status])}</span></div>
   </article>):<p className="commission-empty">{t("ไม่มีรายการตามเงื่อนไขที่เลือก")}</p>}</div>
   {pages>1&&<nav className="commission-pagination" aria-label={t("หน้ารายการค่าคอม")}>{page>1&&<Link href={href({commissionPage:String(page-1)})}>{t("← ก่อนหน้า")}</Link>}<span>{t("หน้า ")}{page} / {pages}</span>{page<pages&&<Link href={href({commissionPage:String(page+1)})}>{t("ถัดไป →")}</Link>}</nav>}
  </section>
  </CommissionDialog>
  <section id="employee-review-orders" className="employee-review-orders">
   <div className="commission-section-title"><h2>{t("รายการต้องตรวจสอบ")}</h2><p>{t("ออเดอร์ของคุณทั้งหมด รวมรายการค้างจากเดือนก่อน")}</p></div>
   {reviews.length?reviews.slice(0,3).map(r=><article className="commission-row" key={r.id}><div><h3>{r.number}</h3><p>{r.reasons.map(reason=>t(reason)).join(' · ')}</p><small>{t("รับออเดอร์ ")}{date(r.createdAt)}</small></div><Link className="review-order-link" href={'/my-performance/orders/'+encodeURIComponent(r.id)}>{t("ตรวจสอบ →")}</Link></article>):<p className="commission-empty">{t("ไม่มีรายการต้องตรวจสอบ")}</p>}
   {reviews.length>0&&<Link className="employee-view-tasks" href="/my-performance/tasks">{t("ดูงานค้างทั้งหมด ")}{reviews.length} {t(" รายการ →")}</Link>}
  </section>
 </section>;
}
