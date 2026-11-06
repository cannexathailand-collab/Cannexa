import {randomUUID} from 'node:crypto';
import type {CrmPointPromotion} from '@prisma/client';
import {bangkokDay,shiftDay} from '@/lib/sales-dates';
function PromotionForm({promotion,editable}:{promotion?:CrmPointPromotion;editable:boolean}){
 const today=bangkokDay(new Date());
 return <form action="/api/admin/crm/promotions" method="post"><fieldset disabled={!editable} style={{border:0,padding:0,margin:0}}>
  {promotion&&<input type="hidden" name="id" value={promotion.id}/>}<input type="hidden" name="requestKey" value={promotion?.requestKey??randomUUID()}/>
  <label>ชื่อโปรโมชั่น<input name="name" maxLength={120} required defaultValue={promotion?.name??''} placeholder="เช่น โบนัสสมาชิกเดือนนี้"/></label>
  <div className="stats">
   <label>เริ่มวันที่<input type="date" name="from" required defaultValue={promotion?bangkokDay(promotion.startsAt):today}/></label>
   <label>ถึงวันที่<input type="date" name="to" required defaultValue={promotion?bangkokDay(new Date(+promotion.endsAt-1)):shiftDay(today,6)}/></label>
   <label>ยอดซื้อขั้นต่ำต่อออเดอร์ (บาท)<input type="number" name="minimumBaht" min="0.01" max="21474836.47" step="0.01" required defaultValue={promotion?promotion.minimumSatang/100:''}/></label>
   <label>ชนิดโบนัส<select name="bonusType" defaultValue={promotion?.bonusType??'PERCENT'}><option value="PERCENT">เพิ่มเป็น % ของแต้มปกติ</option><option value="POINTS">เพิ่มเป็นจำนวนแต้ม</option></select></label>
  </div>
  <label>ค่าโบนัส<input type="number" name="bonusValue" min="1" max="1000000" step="1" required defaultValue={promotion?.bonusValue??''} placeholder="เช่น 70"/><small>หากเลือกเปอร์เซ็นต์ ใส่ 70 คือเพิ่มอีก 70% ของแต้มปกติ (ตั้งได้ 1–1,000%)</small></label>
  <label><input type="checkbox" name="enabled" defaultChecked={promotion?.enabled??false}/> เปิดใช้โปรโมชั่น</label>
  <button type="submit">{promotion?'บันทึกโปรโมชั่น':'สร้างโปรโมชั่น'}</button>
 </fieldset></form>;
}
export function CrmPointPromotions({promotions,editable,pointsEnabled}:{promotions:CrmPointPromotion[];editable:boolean;pointsEnabled:boolean}){
 const now=new Date();
 return <section aria-label="โปรโมชั่นแต้มโบนัส"><h2>โปรโมชั่นแต้มโบนัส</h2><p>รับโบนัสเพิ่มจากแต้มปกติ เมื่อยอดซื้อในออเดอร์ถึงขั้นต่ำภายในช่วงโปรโมชั่น</p>{!pointsEnabled&&<p className="notice">บันทึกอัตราแยกตามระดับและเปิดสะสมแต้มด้านบน เพื่อให้โปรโมชั่นเริ่มให้แต้มได้</p>}
 <details className="card"><summary>สร้างโปรโมชั่นโบนัส</summary><PromotionForm editable={editable}/></details>
 {promotions.map(p=><details className="card" key={p.id}><summary><strong>{p.name}</strong> · {!p.enabled?'ปิดอยู่':now<p.startsAt?'ยังไม่เริ่ม':now>=p.endsAt?'สิ้นสุดแล้ว':'กำลังใช้งาน'} · ซื้อครบ {(p.minimumSatang/100).toLocaleString('th-TH')} บาท เพิ่ม {p.bonusValue}{p.bonusType==='PERCENT'?'%':' แต้ม'}</summary><PromotionForm promotion={p} editable={editable}/></details>)}
 <p className="muted">หากออเดอร์เข้าได้หลายโปรโมชั่น จะรับโบนัสที่สูงที่สุดเพียงรายการเดียว ช่วงวันที่นับตามเวลาไทย และเก็บเงื่อนไขไว้ตอนรับออเดอร์ การแก้หรือปิดโปรโมชั่นไม่เปลี่ยนโบนัสของออเดอร์เดิม ได้รับแต้มเมื่อซื้อสำเร็จ และไม่ให้แต้มกับออเดอร์ยกเลิกหรือตีกลับ</p></section>;
}
