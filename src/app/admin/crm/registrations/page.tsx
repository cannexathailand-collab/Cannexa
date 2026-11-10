import Link from 'next/link';
import {requireAdminPage} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {db} from '@/lib/db';
import {displayCustomerCode} from '@/lib/customer-code';
import {ApproveRegistration} from './approve-button';
import {CustomerDeleteButton} from '../../customer-delete-button';
import {activeCustomerProfileFilter} from '@/lib/customer-profile-deletion';

export default async function Registrations({searchParams}:{searchParams:Promise<{status?:string;page?:string}>}){
 const actor=await requireAdminPage(managers);
 const params=await searchParams;
 const status=params.status==='pending'||params.status==='approved'?params.status:'all';
 const page=Math.max(1,Math.min(100000,Math.trunc(Number(params.page))||1));
 const where={AND:[activeCustomerProfileFilter,{portalProfileIncomplete:false},...(status==='all'?[]:[{portalRegistrationPending:status==='pending'}])]};
 const [rows,count]=await Promise.all([
  db.customer.findMany({where,orderBy:[{registeredAt:{sort:'desc',nulls:'last'}},{createdAt:'desc'},{code:'desc'}],skip:(page-1)*50,take:50,select:{code:true,name:true,phone:true,address:true,createdAt:true,registeredAt:true,portalRegistrationPending:true,referrer:{select:{code:true,name:true}}}}),
  db.customer.count({where}),
 ]);
 const date=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'});
 const pages=Math.ceil(count/50);
 return <>
  <h1>คำขอสมัครสมาชิก</h1>
  <p>ผู้สมัครล่าสุดอยู่บนสุด ตรวจสอบวันที่สมัครและสถานะได้ในรายการ</p>
  <form className="filters" action="/admin/crm/registrations">
   <label>สถานะ<select name="status" defaultValue={status}><option value="all">ทั้งหมด</option><option value="pending">รออนุมัติ</option><option value="approved">สมัครสำเร็จ</option></select></label>
   <button type="submit">แสดงรายการ</button>
  </form>
  <p>พบ {count.toLocaleString('th-TH')} รายการ · เรียงสมัครล่าสุดก่อน</p>
  {!rows.length&&<p className="notice live">ไม่พบผู้สมัครในสถานะนี้</p>}
  {rows.map(row=><section className="card" key={row.code}>
   <h2>{row.name??displayCustomerCode(row.code)}</h2>
   <p><span className="pill">{row.portalRegistrationPending?'รออนุมัติ':'สมัครสำเร็จ'}</span></p>
   <p>วันที่สมัคร {date.format(row.registeredAt??row.createdAt)}</p>
   <p>เบอร์โทร {row.phone??'ยังไม่ระบุ'}</p>
   {row.address&&<p>ที่อยู่ {row.address}</p>}
   {row.referrer&&<p>ผู้แนะนำ {row.referrer.name} ({row.referrer.code})</p>}
   <p>รหัสลูกค้า {displayCustomerCode(row.code)}</p>
   {row.portalRegistrationPending&&<ApproveRegistration code={row.code}/>}
   <p><Link href={'/admin/crm/'+encodeURIComponent(row.code)}>ตรวจข้อมูลใน CRM</Link></p>
   {(actor.role==='owner'||actor.role==='admin')&&<CustomerDeleteButton code={row.code} name={row.name}/>}
  </section>)}
  {pages>1&&<nav aria-label="หน้ารายการผู้สมัคร">
   {page>1&&<Link className="button secondary" href={'?status='+status+'&page='+(page-1)}>ก่อนหน้า</Link>}
   <span> หน้า {page} / {pages} </span>
   {page<pages&&<Link className="button secondary" href={'?status='+status+'&page='+(page+1)}>ถัดไป</Link>}
  </nav>}
 </>;
}
