import {db} from '@/lib/db';
import {managers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';

export default async function CrmPoints({searchParams}:{searchParams:Promise<{saved?:string}>}){
 const actor=await requireAdminPage(managers),p=await searchParams;
 const rule=await db.crmPointRule.findFirst({orderBy:{effectiveAt:'desc'}});
 return <><h1>ตั้งค่าสะสมแต้ม</h1><p>กำหนดอัตราสะสมแต้มจากยอดซื้อสำเร็จของลูกค้าใน CRM</p>{p.saved==='1'&&<p className="notice live">บันทึกอัตราแต้มแล้ว ใช้กับยอดซื้อสำเร็จใหม่ตั้งแต่เวลาที่บันทึก</p>}
 <section className="card"><h2>{rule?.enabled?`${rule.satangPerPoint/100} บาท = 1 แต้ม`:'ยังไม่เปิดสะสมแต้ม'}</h2>{['owner','admin'].includes(actor.role)?<form action="/api/admin/crm/points" method="post"><label>ยอดซื้อกี่บาทต่อ 1 แต้ม<input type="number" min="0.01" step="0.01" name="bahtPerPoint" required defaultValue={rule?rule.satangPerPoint/100:100}/></label><label><input type="checkbox" name="enabled" defaultChecked={rule?.enabled??false}/> เปิดสะสมแต้ม</label><button type="submit">บันทึกอัตราแต้ม</button></form>:<p>เจ้าของหรือแอดมินเป็นผู้ปรับอัตราแต้ม</p>}<p className="muted">ยังไม่ให้แต้มจนกว่าจะเปิดใช้งาน คำนวณแยกแต่ละออเดอร์ที่ซื้อสำเร็จ เศษไม่ครบหนึ่งแต้มปัดลง การเปลี่ยนอัตราไม่ย้อนเปลี่ยนอัตราของยอดซื้อเดิม ยกเลิกหรือคืนสินค้าจะไม่นับแต้ม</p></section></>;
}
