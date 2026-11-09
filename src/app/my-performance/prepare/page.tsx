import {requireEmployeePage} from '@/lib/employee-view';
import {orderTemplates} from '@/lib/order-templates';
import {db} from '@/lib/db';
import {EmployeeNav} from '../employee-nav';
import {OrderDraftBuilder} from './order-draft-builder';
export default async function PrepareOrder(){
 const actor=await requireEmployeePage();
 if(!actor.affiliateId)return <main className="center-page performance-page"><section className="customer"><h1>สร้างออเดอร์</h1><EmployeeNav active="prepare"/><p>{actor.role==='owner'?'เลือกพนักงานด้านบนก่อนสร้างออเดอร์':'บัญชียังไม่ได้ผูกกับ Affiliate'}</p></section></main>;
 const [groups,templates]=await Promise.all([db.orderGroup.findMany({where:{enabled:true,purpose:'ORDER'},select:{id:true,name:true},orderBy:{name:'asc'}}),orderTemplates()]);
 return <main className="center-page performance-page"><section className="customer"><h1>สร้างออเดอร์</h1><p className="muted">ตรวจข้อมูลลูกค้า สินค้า และยอดเงิน แล้วบันทึกออเดอร์เข้าระบบ</p><EmployeeNav active="prepare"/><OrderDraftBuilder seller={actor.username} initialTemplates={templates} directOrders={{groups,sellers:[{username:actor.username}],endpoint:'/api/my-performance/orders/create',detailBase:'/my-performance/orders/',lockSeller:true}}/></section></main>;
}
