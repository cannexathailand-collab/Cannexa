import {requireEmployeePage} from '@/lib/employee-view';
import {orderTemplates} from '@/lib/order-templates';
import {EmployeeNav} from '../employee-nav';
import {OrderDraftBuilder} from './order-draft-builder';
export default async function PrepareOrder(){
 const a=await requireEmployeePage();
 return <main className="center-page performance-page"><section className="customer"><h1>สรุปยอดส่งงาน</h1><p className="muted">จัดข้อมูลลูกค้า สินค้า และยอดเงินลงแบบฟอร์มพร้อมคัดลอก</p><EmployeeNav active="prepare"/><OrderDraftBuilder seller={a.username} initialTemplates={await orderTemplates()}/></section></main>;
}
