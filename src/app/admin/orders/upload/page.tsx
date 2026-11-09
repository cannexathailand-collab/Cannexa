import {stockEditors} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {ShipmentUpload} from './upload-form';
export default async function UploadPage(){
 const actor=await requireAdminPage(stockEditors);
 return <><h1>อัปโหลดรายการจัดส่ง</h1><p>ใช้ไฟล์ Excel หรือ CSV ที่ส่งออกจากระบบของคุณ ตรวจรายการและยืนยันส่งพัสดุก่อนนำเข้า</p><ShipmentUpload ordersHref={actor.role==='store'?'/admin/store-orders':'/admin/orders/list'}/></>;
}
