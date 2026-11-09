import {requireAdminPage} from '@/lib/auth';
import {db} from '@/lib/db';
import {orderTemplates} from '@/lib/order-templates';
import {OrderDraftBuilder} from '@/app/my-performance/prepare/order-draft-builder';

export default async function CreateOrder(){
 await requireAdminPage();
 const [groups,sellers,templates]=await Promise.all([
  db.orderGroup.findMany({where:{enabled:true,purpose:'ORDER'},select:{id:true,name:true},orderBy:{name:'asc'}}),
  db.userAccount.findMany({where:{role:'employee',active:true,affiliate:{active:true,archivedAt:null}},select:{username:true},orderBy:{username:'asc'}}),
  orderTemplates(),
 ]);
 return <><h1>สร้างออเดอร์</h1><p>วางข้อมูลลูกค้า แยกข้อมูล ตรวจรายละเอียด แล้วบันทึกออเดอร์เข้าระบบ</p><OrderDraftBuilder seller="" initialTemplates={templates} directOrders={{groups,sellers}}/></>;
}
