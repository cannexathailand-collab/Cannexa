import {db} from '@/lib/db';
import {managers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {pointTierKeys,pointTierNames,tierPointRatesSchema} from '@/lib/crm-tier-points';
import {CrmPointPromotions} from '@/app/crm-point-promotions';
import '@/app/loyalty.css';

export default async function CrmPoints({searchParams}:{searchParams:Promise<{saved?:string;promotionSaved?:string}>}){
 const actor=await requireAdminPage(managers),p=await searchParams;
 const rule=await db.crmPointRule.findFirst({orderBy:{effectiveAt:'desc'}});
 const existing=tierPointRatesSchema.safeParse(rule?.tierRates);
 const legacyRate=rule?Math.min(1000000,Math.floor(100000/rule.satangPerPoint)):10;
 const promotions=await db.crmPointPromotion.findMany({orderBy:{createdAt:'desc'}});
 return <div className="loyalty-page"><div className="loyalty-page-heading"><span className="loyalty-overline">MEMBER REWARDS</span><h1>ตั้งค่าสะสมแต้ม</h1><p>ดูแลลูกค้าแต่ละระดับ ด้วยแต้มสะสมและโบนัสพิเศษ</p></div>{p.saved==='1'&&<p className="notice live">บันทึกอัตราแต้มแยกตามระดับแล้ว ใช้กับออเดอร์ใหม่หลังบันทึก</p>}
 <section className="card loyalty-base"><div className="loyalty-section-heading"><div><h2>แต้มปกติตามระดับสมาชิก</h2><p>กำหนดแต้มที่ได้รับ ต่อยอดซื้อทุก 1,000 บาท</p></div><span className={'loyalty-status '+(rule?.enabled?'is-active':'')}>{rule?.enabled?'เปิดสะสมแต้ม':'ยังไม่เปิดสะสมแต้ม'}</span></div><form action="/api/admin/crm/points" method="post"><input type="hidden" name="mode" value="tier"/>
 <fieldset disabled={!['owner','admin'].includes(actor.role)} style={{border:0,padding:0,margin:0}}><label><input type="checkbox" name="enabled" defaultChecked={rule?.enabled??false}/> เปิดสะสมแต้ม</label>
 <div className="table-wrap"><table><thead><tr><th>ระดับสมาชิก</th><th>ยอดซื้อ</th><th>แต้มที่ได้รับ</th></tr></thead><tbody>{pointTierKeys.map(key=><tr key={key}><th scope="row"><span className={'loyalty-tier tier-'+key}><i/>{pointTierNames[key]}</span></th><td>1,000 บาท</td><td><div className="loyalty-rate"><input aria-label={'แต้มต่อ 1,000 บาท '+pointTierNames[key]} name={'points_'+key} type="number" min="0" max="1000000" step="1" required defaultValue={existing.success?existing.data[key]:legacyRate}/><span>แต้ม</span></div></td></tr>)}</tbody></table></div>
 <button type="submit">บันทึกอัตราแต้ม</button></fieldset></form>
 <p className="muted">ใส่ 0 หากไม่ให้แต้มในระดับนั้น ใช้อัตราและระดับสมาชิกขณะรับออเดอร์ และให้แต้มเมื่อซื้อสำเร็จเท่านั้น การเปลี่ยนอัตราหรือระดับภายหลังไม่เปลี่ยนแต้มของออเดอร์เดิม</p>
 <p className="muted">คำนวณตามสัดส่วนยอดซื้อ เช่น ตั้ง 20 แต้มต่อ 1,000 บาท ซื้อ 500 บาทได้ 10 แต้ม เศษแต้มปัดลงแยกแต่ละออเดอร์ ยกเลิกหรือคืนสินค้าจะไม่นับแต้ม</p>
 </section>{p.promotionSaved==='1'&&<p className="notice live">บันทึกโปรโมชั่นแล้ว ใช้กับออเดอร์ใหม่ตามช่วงวันที่ที่กำหนด</p>}<CrmPointPromotions promotions={promotions} editable={['owner','admin'].includes(actor.role)} pointsEnabled={!!rule?.enabled&&!!rule.tierRates} rates={pointTierKeys.map(key=>({name:pointTierNames[key],rate:existing.success?existing.data[key]:legacyRate}))}/></div>;
}
