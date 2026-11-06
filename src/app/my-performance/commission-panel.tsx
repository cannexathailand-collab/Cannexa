import Link from 'next/link';
import {employeeCommissions,commissionKinds} from '@/lib/employee-commissions';
import {commissionMonth} from '@/lib/commission-month';
import {employeeReviewOrders} from '@/lib/employee-review-orders';
type Filters={kind?:string;status?:string;commissionMonth?:string;commissionPage?:string;month?:string;reviewPage?:string};
const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
const date=(d:Date)=>d.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'2-digit'});
const statuses={PENDING:'รอจ่าย',PAID:'จ่ายแล้ว',WAITING:'รอคำนวณ / ตรวจสอบ'};
export async function CommissionPanel({affiliateId,username,filters}:{affiliateId:string;username:string;filters:Filters}){
 const [data,reviews]=await Promise.all([employeeCommissions(affiliateId),employeeReviewOrders(affiliateId,username)]);
 const reviewPages=Math.max(1,Math.ceil(reviews.length/20)),reviewPage=Math.min(reviewPages,Math.max(1,Number.parseInt(filters.reviewPage??'1',10)||1));
 const kind=filters.kind&&Object.hasOwn(commissionKinds,filters.kind)?filters.kind:'ALL';
 const status=filters.status&&Object.hasOwn(statuses,filters.status)?filters.status:'ALL';
 const months=[...new Set(data.rows.map(r=>commissionMonth(r.date)))].sort().reverse();
 const month=months.includes(filters.commissionMonth??'')?filters.commissionMonth!:'ALL';
 const filtered=data.rows.filter(r=>(kind==='ALL'||r.kind===kind)&&(status==='ALL'||r.status===status)&&(month==='ALL'||commissionMonth(r.date)===month));
 const pages=Math.max(1,Math.ceil(filtered.length/25)),page=Math.min(pages,Math.max(1,Number.parseInt(filters.commissionPage??'1',10)||1));
 const rows=filtered.slice((page-1)*25,page*25);
 const href=(values:Partial<Filters>)=>'/my-performance?'+new URLSearchParams(Object.entries({...filters,kind,status,commissionMonth:month,commissionPage:'1',...values}).filter(([,v])=>v!==undefined) as [string,string][]).toString()+'#commission-details';
 return <section className="employee-commissions" aria-label="รายละเอียดค่าคอมมิชชัน">
  <div className="commission-summary-grid">
   <article className="commission-metric"><span>ค่าคอมรอจ่ายทั้งหมด</span><strong>{money(data.pending)}</strong><small>ทุกรอบที่คำนวณแล้วและยังไม่จ่าย</small></article>
   <article className="commission-metric"><span>ค่าคอมจ่ายแล้วทั้งหมด</span><strong>{money(data.paid)}</strong><small>รวมค่าคอมพิเศษที่บันทึกจ่ายแล้ว</small></article>
   <article className="commission-metric"><span>รอคำนวณ / ตรวจสอบ</span><strong>{data.waiting.toLocaleString('th-TH')} <em>รายการ</em></strong><small>ยังไม่รวมในยอดรอจ่าย</small></article>
   <a className="commission-metric review-metric" href="#employee-review-orders"><span>รายการต้องตรวจสอบ</span><strong>{reviews.length.toLocaleString('th-TH')} <em>ออเดอร์</em></strong><small>ดูเหตุผลและเปิดตรวจสอบออเดอร์ →</small></a>
  </div>
  <div className="commission-section-title"><h2>ค่าคอมแต่ละประเภท</h2><p>ยอดรวมตลอดทั้งหมด แยกรอจ่ายและจ่ายแล้ว</p></div>
  <div className="commission-category-grid">{data.categories.map(c=><article className="commission-category" key={c.kind}>
   <h3>{commissionKinds[c.kind]}</h3><span>รอจ่าย</span><strong>{money(c.pending)}</strong><p>จ่ายแล้ว <b>{money(c.paid)}</b></p><small>{c.waiting?`รอคำนวณ / ตรวจสอบ ${c.waiting} รายการ`:`ทั้งหมด ${c.count} รายการ`}</small>
   <Link href={href({kind:c.kind,status:'ALL',commissionMonth:'ALL'})}>ดูรายละเอียด <span aria-hidden="true">→</span></Link>
  </article>)}</div>
  <section id="commission-details" className="commission-details">
   <div className="commission-section-title"><h2>รายละเอียดค่าคอม</h2><p>{filtered.length.toLocaleString('th-TH')} รายการ · วันที่รายการและวันที่จ่ายแสดงแยกกัน</p></div>
   <form method="get" action="/my-performance#commission-details" className="commission-filters">
    {filters.month&&<input type="hidden" name="month" value={filters.month}/>}
    <label>ประเภท<select name="kind" defaultValue={kind}>{[['ALL','ทุกประเภท'],...Object.entries(commissionKinds)].map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label>
    <label>สถานะ<select name="status" defaultValue={status}>{[['ALL','ทุกสถานะ'],...Object.entries(statuses)].map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label>
    <label>เดือนของรายการ<select name="commissionMonth" defaultValue={month}><option value="ALL">ทุกเดือน</option>{months.map(m=><option value={m} key={m}>{new Date(m+'-01T00:00:00+07:00').toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',month:'long',year:'numeric'})}</option>)}</select></label>
    <button type="submit">แสดงรายการ</button>
   </form>
   <div className="commission-rows">{rows.length?rows.map(r=><article className="commission-row" key={r.id}>
    <div><span className="commission-kind">{commissionKinds[r.kind]}</span><h3>{r.reference}</h3><p>{r.note}</p><small>วันที่รายการ {date(r.date)}{r.paidAt?` · จ่ายเมื่อ ${date(r.paidAt)}`:''}</small></div>
    <div className="commission-row-amount"><strong>{r.amount===null?'รอคำนวณ':money(r.amount)}</strong><span className={'commission-status '+r.status.toLowerCase()}>{statuses[r.status]}</span></div>
   </article>):<p className="commission-empty">ไม่มีรายการตามเงื่อนไขที่เลือก</p>}</div>
   {pages>1&&<nav className="commission-pagination" aria-label="หน้ารายการค่าคอม">{page>1&&<Link href={href({commissionPage:String(page-1)})}>← ก่อนหน้า</Link>}<span>หน้า {page} / {pages}</span>{page<pages&&<Link href={href({commissionPage:String(page+1)})}>ถัดไป →</Link>}</nav>}
  </section>
  <section id="employee-review-orders" className="employee-review-orders">
   <div className="commission-section-title"><h2>รายการต้องตรวจสอบ</h2><p>ออเดอร์ของคุณทั้งหมด รวมรายการค้างจากเดือนก่อน</p></div>
   {reviews.length?reviews.slice((reviewPage-1)*20,reviewPage*20).map(r=><article className="commission-row" key={r.id}><div><h3>{r.number}</h3><p>{r.reasons.join(' · ')}</p><small>รับออเดอร์ {date(r.createdAt)}</small></div><Link className="review-order-link" href={'/my-performance/orders/'+encodeURIComponent(r.id)}>ตรวจสอบ →</Link></article>):<p className="commission-empty">ไม่มีรายการต้องตรวจสอบ</p>}
   {reviewPages>1&&<nav className="commission-pagination" aria-label="หน้ารายการต้องตรวจสอบ">{reviewPage>1&&<Link href={href({reviewPage:String(reviewPage-1)}).replace('#commission-details','#employee-review-orders')}>← ก่อนหน้า</Link>}<span>หน้า {reviewPage} / {reviewPages}</span>{reviewPage<reviewPages&&<Link href={href({reviewPage:String(reviewPage+1)}).replace('#commission-details','#employee-review-orders')}>ถัดไป →</Link>}</nav>}
  </section>
 </section>;
}
