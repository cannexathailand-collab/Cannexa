import {requireAdminPage} from '@/lib/auth';
import {db} from '@/lib/db';
import {DocumentBrandingForm} from '@/app/document-branding-form';

export default async function Branding(){
 await requireAdminPage();
 const brand=await db.storeBranding.findUnique({where:{id:'active'}});
 return <><h1>ตั้งค่าแบรนด์หลักของร้าน</h1><section className="card">
  <p>ชื่อ โลโก้ และสีใช้ร่วมกันในหน้าล็อกอิน หน้าลูกค้า หลังบ้าน และเอกสารของร้านนี้</p>
  <p className="muted">ข้อมูลบริษัทและผู้เสียภาษีตั้งแยกในส่วนเอกสาร เอกสารที่ออกแล้วเก็บแบรนด์เดิมไว้</p>
  <DocumentBrandingForm initial={brand}/>
 </section></>;
}
