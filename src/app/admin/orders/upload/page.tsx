import {requireAdminPage} from '@/lib/auth';
import {ShipmentUpload} from './upload-form';
export default async function UploadPage(){
 await requireAdminPage();
 return <><h1>อัปโหลดรายการจัดส่ง</h1><p>ใช้ไฟล์ Excel หรือ CSV ที่ส่งออกจากระบบของคุณ ตรวจรายการและยืนยันส่งพัสดุก่อนนำเข้า</p><ShipmentUpload/></>;
}
