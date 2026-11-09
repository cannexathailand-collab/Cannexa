import {requireAdminPage} from '@/lib/auth';
import {loadOrderRoundSettings} from '@/lib/order-round-settings';
import {OrderRoundForm} from './round-form';
export default async function OrderSettings(){
 await requireAdminPage();const settings=await loadOrderRoundSettings();
 return <><h1>ตั้งค่าปิดรอบออเดอร์</h1><p>ตั้งเวลาแบ่งรอบรายวันตามเวลาไทย ชื่อรอบใช้วันที่ปิดรอบ</p><OrderRoundForm initial={settings}/></>;
}
