import Link from 'next/link';
import {requireAdminPage} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {db} from '@/lib/db';
import {displayCustomerCode} from '@/lib/customer-code';
import {ApproveRegistration} from './approve-button';
export default async function Registrations(){
 await requireAdminPage(managers);
 const rows=await db.customer.findMany({where:{portalRegistrationPending:true},orderBy:{createdAt:'asc'},select:{code:true,name:true,phone:true,address:true,createdAt:true,referrer:{select:{code:true,name:true}}}});
 return <><h1>คำขอสมัครสมาชิก</h1><p>ตรวจข้อมูลลูกค้าใหม่จากหน้าเว็บไซต์ แล้วอนุมัติให้เข้าใช้งาน</p>{!rows.length&&<p className="notice live">ไม่มีคำขอรออนุมัติ</p>}{rows.map(row=><section className="card" key={row.code}><h2>{row.name}</h2><p>เบอร์โทร {row.phone}</p><p>ที่อยู่ {row.address}</p>{row.referrer&&<p>ผู้แนะนำ {row.referrer.name} ({row.referrer.code})</p>}<p>รหัสลูกค้า {displayCustomerCode(row.code)}</p><ApproveRegistration code={row.code}/><p><Link href={'/admin/crm/'+encodeURIComponent(row.code)}>ตรวจข้อมูลใน CRM</Link></p></section>)}</>;
}
