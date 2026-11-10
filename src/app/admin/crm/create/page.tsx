import Link from 'next/link';
import {requireAdminPage} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {AdminCustomerRegistrationForm} from './registration-form';

export default async function CreateCustomerPage(){
 await requireAdminPage(managers);
 return <>
  <p><Link href="/admin/crm/customer-entry">← กลับหน้าลูกค้า</Link></p>
  <h1>สมัครสมาชิกให้ลูกค้า</h1>
  <p>กรอกข้อมูล ตั้งรหัสผ่าน และเลือกระดับสมาชิกเริ่มต้น ระบบจะออกรหัสลูกค้าให้เมื่อบันทึกสำเร็จ</p>
  <AdminCustomerRegistrationForm/>
 </>;
}
