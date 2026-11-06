import {requireAdminPage} from '@/lib/auth';
import {orderTemplates} from '@/lib/order-templates';
import {OrderDraftBuilder} from '@/app/my-performance/prepare/order-draft-builder';
export default async function PrepareOrder(){
 const a=await requireAdminPage(['owner','admin','manager']);
 return <><h1>สรุปยอดส่งงาน</h1><p className="muted">จัดข้อมูลลงแบบฟอร์ม ตรวจแก้ และคัดลอกสำหรับส่งงาน</p><OrderDraftBuilder seller={a.username} initialTemplates={await orderTemplates()} canManage/></>;
}
