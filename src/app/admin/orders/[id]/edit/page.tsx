import {notFound} from 'next/navigation';
import {requireAdminPage} from '@/lib/auth';
import {db} from '@/lib/db';
import {orderEditVersion} from '@/lib/order-changes';
import {OrderEditForm} from './edit-form';
export default async function EditOrder({params}:{params:Promise<{id:string}>}){
 await requireAdminPage();const {id}=await params;
 const order=await db.orderIntake.findUnique({where:{id}});if(!order)notFound();
 return <><h1>แก้ไขออเดอร์ {order.orderNumber}</h1><p>แก้ไขก่อนจัดส่ง พร้อมเก็บประวัติข้อมูลเดิมและตรวจสต๊อกใหม่</p><OrderEditForm id={id} initialText={order.rawText??''} version={orderEditVersion(order)}/></>;
}
