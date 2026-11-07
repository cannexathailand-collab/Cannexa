import {db} from '@/lib/db';
import {crmDate,crmMoney} from '@/lib/customer-crm';

export async function CustomerPromotions(){
 const now=new Date();
 const rule=await db.crmPointRule.findFirst({where:{effectiveAt:{lte:now}},orderBy:{effectiveAt:'desc'},select:{enabled:true,tierRates:true}});
 const promotions=rule?.enabled&&rule.tierRates?await db.crmPointPromotion.findMany({
  where:{enabled:true,startsAt:{lte:now},endsAt:{gt:now}},
  orderBy:{endsAt:'asc'},
  select:{id:true,name:true,startsAt:true,endsAt:true,minimumSatang:true,bonusType:true,bonusValue:true},
 }):[];

 return <section className="portal-section">
  <div className="portal-section-title"><h2>โปรโมชั่น</h2><span>{promotions.length} รายการ</span></div>
  {promotions.length?<>
   <div className="portal-offers">{promotions.map(promotion=><article className="portal-offer" key={promotion.id}>
    <span className="portal-offer-bonus">+{promotion.bonusValue.toLocaleString('th-TH')}{promotion.bonusType==='PERCENT'?'%':' Green Coin'}</span>
    <h3>{promotion.name}</h3>
    <p>ซื้อครบ {crmMoney(promotion.minimumSatang)}</p>
    {promotion.bonusType==='PERCENT'&&<p>รับโบนัสเพิ่มจาก Green Coin ปกติ</p>}
    <small>{crmDate(promotion.startsAt)} – {crmDate(new Date(+promotion.endsAt-1))}</small>
   </article>)}</div>
   <p className="portal-muted">รับโบนัสสูงสุด 1 โปรโมชั่นต่อออเดอร์ เมื่อซื้อสำเร็จตามเงื่อนไข</p>
  </>:<div className="portal-empty">ยังไม่มีโปรโมชั่นที่เปิดใช้งาน</div>}
 </section>;
}
