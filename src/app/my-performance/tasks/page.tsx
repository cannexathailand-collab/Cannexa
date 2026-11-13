import {employeeLanguage} from '@/lib/employee-language-server';
import Link from 'next/link';
import {requireEmployeePage} from '@/lib/employee-view';
import {employeeReviewOrders,employeeTaskTypes} from '@/lib/employee-review-orders';
import {EmployeeNav} from '../employee-nav';
const nextSteps={TRACKING:'ติดตามเลขพัสดุกับทีมจัดส่ง',COD:'แจ้งผู้ดูแลตรวจรายงานรับเงิน COD',COST:'ติดตามข้อมูลต้นทุนสินค้ากับผู้ดูแล',DATA:'เปิดดูสาเหตุและแจ้งข้อมูลที่ต้องแก้กับผู้ดูแล'};
export default async function EmployeeTasks({searchParams}:{searchParams:Promise<{type?:string;q?:string;page?:string}>}){
 const {t,locale,language}=await employeeLanguage();

 const a=await requireEmployeePage(),input=await searchParams;
 const all=a.affiliateId?await employeeReviewOrders(a.affiliateId,a.username):[];
 const type=input.type&&Object.hasOwn(employeeTaskTypes,input.type)?input.type:'ALL',q=(input.q??'').trim().slice(0,100);
 const filtered=all.filter(r=>(type==='ALL'||r.type===type)&&(!q||[r.number,r.recipient].some(v=>v?.toLocaleLowerCase().includes(q.toLocaleLowerCase()))));
 const pages=Math.max(1,Math.ceil(filtered.length/25)),page=Math.min(pages,Math.max(1,Number.parseInt(input.page??'1',10)||1));
 const href=(next:string,p=1)=>'/my-performance/tasks?'+new URLSearchParams({type:next,q,page:String(p)}).toString();
 return <main className="center-page performance-page"><section className="customer employee-tasks-page">
  <h1>{t("งานค้างของฉัน")}</h1><p className="muted">{t("งานที่ต้องติดตาม เรียงจากออเดอร์เก่าก่อน และอัปเดตตามข้อมูลล่าสุด")}</p><EmployeeNav active="tasks"/>
  <div className={'employee-task-alert '+(!all.length?'clear':'')} role="status"><div><strong>{all.length?`${t('มีงานค้าง')} ${all.length} ${t('ออเดอร์')}`:t('ไม่มีงานค้างที่ต้องตรวจสอบ')}</strong><p>{all.length?t('เปิดดูสาเหตุและติดตามรายการที่ค้างอยู่'):t('เมื่อมีออเดอร์เข้าเงื่อนไข ระบบจะแสดงที่นี่อัตโนมัติ')}</p></div></div>
  <nav className="employee-task-types" aria-label={t("ประเภทงานค้าง")}><Link className={type==='ALL'?'active':''} href={href('ALL')}>{t("ทั้งหมด ")}<b>{all.length}</b></Link>{Object.entries(employeeTaskTypes).map(([key,label])=><Link className={type===key?'active':''} key={key} href={href(key)}>{t(label)} <b>{all.filter(r=>r.type===key).length}</b></Link>)}</nav>
  <form className="employee-task-search" method="get"><input type="hidden" name="type" value={type}/><label>{t("ค้นหางานค้าง")}<input name="q" defaultValue={q} placeholder={t("เลขออเดอร์หรือชื่อลูกค้า")}/></label><button>{t("ค้นหา")}</button></form>
  <div className="employee-task-list">{filtered.slice((page-1)*25,page*25).map(r=><article className="employee-task-card" key={r.id}><header><span>{t(employeeTaskTypes[r.type])}</span><small>{r.type==='COD'?t('จัดส่งแล้ว'):t('รับออเดอร์แล้ว')} {r.ageDays} {t(" วัน")}</small></header><h2>{r.number}</h2><p>{r.recipient??t('ยังไม่ระบุผู้รับ')}</p><ul>{r.reasons.map(reason=><li key={reason}>{t(reason)}</li>)}</ul><footer><span>{t(nextSteps[r.type])}</span><Link href={'/my-performance/orders/'+encodeURIComponent(r.id)+'?from=tasks'}>{t("เปิดตรวจสอบ →")}</Link></footer></article>)}</div>
  {!filtered.length&&<p className="commission-empty">{q||type!=='ALL'?t('ไม่พบงานค้างตามเงื่อนไขนี้'):t('งานที่ต้องตรวจสอบครบแล้ว')}</p>}
  {pages>1&&<nav className="commission-pagination" aria-label={t("หน้างานค้าง")}>{page>1&&<Link href={href(type,page-1)}>{t("← ก่อนหน้า")}</Link>}<span>{t("หน้า ")}{page} / {pages}</span>{page<pages&&<Link href={href(type,page+1)}>{t("ถัดไป →")}</Link>}</nav>}
  <p className="small muted">{t("งานจะหายจากรายการเมื่อข้อมูลผ่านเงื่อนไขตรวจสอบแล้ว การเปิดดูไม่เปลี่ยนสถานะออเดอร์หรือค่าคอม")}</p>
 </section></main>;
}
