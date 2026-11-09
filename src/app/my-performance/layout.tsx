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
   <form action="/api/admin/employee-view" method="post">
    <label>เลือกพนักงาน<select name="username" aria-label="เลือกพนักงาน" defaultValue={selected?.username??''}><option value="">เลือกรายชื่อพนักงาน</option>{employees.map(employee=><option value={employee.username} key={employee.username}>{employee.username}{employee.affiliate?' · '+employee.affiliate.name:''}</option>)}</select></label>
    <button>เปิดดู</button>
   </form>
  </section>
  {children}
 </div>;
}
