import Link from 'next/link';
import {approvers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {commissionReport} from '@/lib/commission-report';
import {CommissionMonthSelect} from '@/app/commission-month-select';
const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
export default async function Expenses({searchParams}:{searchParams:Promise<{month?:string}>}){
 await requireAdminPage(approvers);const {groups,month,months}=await commissionReport((await searchParams).month);const entries=[...groups.values()].flat();
 const total=(kind:'FRIEND'|'SALE',status:'Approved'|'Paid')=>entries.filter(e=>e.kind===kind&&e.status===status).reduce((n,e)=>n+e.amountSatang,0);
 const pending=total('FRIEND','Approved')+total('SALE','Approved'),paid=total('FRIEND','Paid')+total('SALE','Paid');
 return <><div className="intro"><div><div className="eyebrow">บัญชี</div><h1>ค่าใช้จ่าย</h1><p className="muted">ค่าคอมมิชชันและรายการค่าใช้จ่ายของกิจการ</p></div></div>
 <CommissionMonthSelect action="/admin/expenses" month={month} months={months} label="เดือนรายการค่าคอม"/>
 <section className="stats"><article className="card stat"><span>ค่าคอมรอจ่าย</span><strong>{money(pending)}</strong><span>รายการค่าคอมของเดือนที่เลือก</span></article><article className="card stat"><span>ค่าคอมจ่ายแล้ว</span><strong>{money(paid)}</strong><span>สถานะของรายการเดือนที่เลือก</span></article></section>
 <section className="card review"><div className="intro"><div><h2>ค่าคอมมิชชัน</h2><p className="muted">ใช้รายการเดียวกับหน้าจ่ายค่าคอม ไม่มีการบันทึกซ้ำ</p></div><Link className="button" href={'/admin/reviews?month='+month}>จัดการค่าคอมมิชชัน</Link></div><div className="table-wrap"><table><thead><tr><th>ประเภท</th><th>รอจ่าย</th><th>จ่ายแล้ว</th></tr></thead><tbody><tr><td>เพิ่มเพื่อน</td><td>{money(total('FRIEND','Approved'))}</td><td>{money(total('FRIEND','Paid'))}</td></tr><tr><td>ยอดขาย</td><td>{money(total('SALE','Approved'))}</td><td>{money(total('SALE','Paid'))}</td></tr></tbody></table></div><p className="muted small">จัดกลุ่มตามเดือนของรายการค่าคอม ไม่ใช่เดือนที่โอนจ่ายจริง</p></section>
 <section className="card"><h2>ค่าใช้จ่ายจากกลุ่ม LINE</h2><p className="muted">ยังไม่ได้ตั้งค่ากลุ่มค่าใช้จ่ายแยกต่างหาก</p><p>ส่วนนี้จะรับข้อมูลจากกลุ่มค่าใช้จ่าย เมื่อกำหนดกลุ่มและรูปแบบข้อความแล้ว</p></section></>;
}
