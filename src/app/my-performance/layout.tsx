import {EmployeeViewForm} from './employee-view-form';
import {employeeRoles} from '@/lib/accounts';
import Link from 'next/link';
import {requireAdminPage} from '@/lib/auth';
import {selectedEmployee} from '@/lib/employee-view';
import {db} from '@/lib/db';
import './owner-view.css';

export default async function EmployeeLayout({children}:{children:React.ReactNode}){
 const actor=await requireAdminPage(employeeRoles);
 if(actor.role!=='owner')return children;
 const [employees,selected]=await Promise.all([
  db.userAccount.findMany({where:{role:{in:employeeRoles},active:true},orderBy:{username:'asc'},select:{username:true,affiliate:{select:{name:true}}}}),
  selectedEmployee(actor),
 ]);
 return <div className="owner-employee-shell">
  <section className="owner-employee-controls" aria-label="มุมมองเจ้าของระบบ">
   <div><strong>เจ้าของระบบ · หน้าพนักงาน</strong><Link href="/admin">กลับหลังบ้าน</Link></div>
   <p role="status">{selected?'กำลังดูข้อมูลของ '+selected.username:'ยังไม่ได้เลือกพนักงาน กรุณาเลือกชื่อเพื่อดูออเดอร์ของคนนั้น'}</p>
   <EmployeeViewForm key={selected?.username??'none'} employees={employees} selected={selected?.username??''}/>
  </section>
  {children}
 </div>;
}
