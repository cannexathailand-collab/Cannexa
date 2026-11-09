import {DuplicateOrderNotice} from '@/app/duplicate-order-notice';
import Link from 'next/link';
import {requireEmployeePage} from '@/lib/employee-view';
import {employeeOrderList,type EmployeeOrderFilters} from '@/lib/employee-order-list';
import {orderStates} from '@/lib/order-management';
import {displayCustomerCode} from '@/lib/customer-code';
import {EmployeeNav} from '../employee-nav';
const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
export default async function EmployeeOrdersPage({searchParams}:{searchParams:Promise<EmployeeOrderFilters>}){
 const a=await requireEmployeePage();
 if(!a.affiliateId)return <main className="center-page performance-page"><section className="customer"><h1>รายการออเดอร์</h1><EmployeeNav active="orders"/><p>{a.role==='owner'?'เลือกรายชื่อพนักงานด้านบนเพื่อดูข้อมูล':'ยังไม่ได้ผูกบัญชีกับ Affiliate'}</p></section></main>;
 const input=await searchParams,data=await employeeOrderList(a.affiliateId,a.username,input);
 const href=(values:EmployeeOrderFilters)=>'/my-performance/orders?'+new URLSearchParams({...data.filters,month:data.month,page:'1',...values}).toString();
 return <main className="center-page performance-page"><section className="customer employee-orders-page">
  <h1>รายการออเดอร์</h1><p className="muted">ค้นหาและติดตามออเดอร์ของ {a.username}</p><EmployeeNav active="orders"/>
  <div className="employee-order-stats">{(['ALL','REVIEW','WAITING','COD'] as const).map(s=><Link key={s} className={data.filters.status===s?'selected':''} href={href({status:s})}><span>{s==='ALL'?'ออเดอร์ทั้งหมด':orderStates[s]}</span><strong>{data.counts[s]}</strong><small>ดูรายการ →</small></Link>)}</div>
  <form method="get" className="employee-order-filters">
   <label className="order-search">ค้นหา<input name="q" defaultValue={data.filters.q} placeholder="เลขออเดอร์ ชื่อ เบอร์โทร หรือเลขพัสดุ"/></label>
   <label>เดือน<select name="month" defaultValue={data.month}>{data.months.map(m=><option key={m} value={m}>{new Date(m+'-01T00:00:00+07:00').toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',month:'short',year:'numeric'})}</option>)}</select></label>
   <label>สถานะ<select name="status" defaultValue={data.filters.status}>{Object.entries(orderStates).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
   <label>การชำระเงิน<select name="payment" defaultValue={data.filters.payment}><option value="ALL">ทั้งหมด</option>{['COD','โอน','เคลม'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
   <label>เรียงรายการ<select name="sort" defaultValue={data.filters.sort}><option value="newest">ใหม่ล่าสุดก่อน</option><option value="oldest">เก่าที่สุดก่อน</option></select></label>
   <div className="employee-order-filter-actions"><button>ค้นหา / แสดงรายการ</button><Link href={'/my-performance/orders?month='+data.month}>ล้างตัวกรอง</Link></div>
  </form>
  <div className="employee-order-list-heading"><h2>รายการออเดอร์</h2><span>{data.count.toLocaleString('th-TH')} รายการ</span></div>
  <div className="employee-order-list">{data.rows.length?data.rows.map(r=><article className={'employee-order-card state-'+r.state.toLowerCase()+(r.duplicateMatches.length?' duplicate-order-row':'')} key={r.order.id}>
   <header><div><strong>{r.order.orderNumber}</strong><small>{r.order.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></div><span className="employee-order-status">{orderStates[r.state]}</span></header>
   <div className="employee-order-card-body"><div><h3>{r.order.recipient??'ยังไม่ระบุผู้รับ'}</h3><p>{r.order.phone??'ยังไม่ระบุเบอร์โทร'}{r.order.customerCode?' · '+displayCustomerCode(r.order.customerCode):''}</p><p className="order-tracking">{r.shipment?.tracking?'เลขพัสดุ '+r.shipment.tracking:'ยังไม่มีเลขพัสดุ'}</p></div><div className="employee-order-money"><small>ยอดออเดอร์ · {r.order.payment??'ไม่ระบุ'}</small><strong>{r.amount===null?'รอข้อมูล':money(r.amount)}</strong><small>ค่าคอม {r.commissionStatus==='CANCELLED'?'ยกเลิก':r.commission===null?'รอคำนวณ':money(r.commission)+(r.commissionStatus==='PAID'?' · จ่ายแล้ว':' · รอจ่าย')}</small></div></div>
   <DuplicateOrderNotice matches={r.duplicateMatches} employee/>{!['CANCELLED','WITHDRAWN'].includes(r.order.status)&&<footer><Link href={'/my-performance/orders/'+encodeURIComponent(r.order.id)}>{r.state==='REVIEW'?'ตรวจสอบออเดอร์':'ดูรายละเอียด'} →</Link></footer>}
  </article>):<p className="commission-empty">ไม่พบออเดอร์ตามเงื่อนไขที่เลือก</p>}</div>
  {data.pages>1&&<nav className="commission-pagination" aria-label="หน้ารายการออเดอร์">{data.page>1&&<Link href={href({page:String(data.page-1)})}>← ก่อนหน้า</Link>}<span>หน้า {data.page} / {data.pages}</span>{data.page<data.pages&&<Link href={href({page:String(data.page+1)})}>ถัดไป →</Link>}</nav>}
 </section></main>;
}
