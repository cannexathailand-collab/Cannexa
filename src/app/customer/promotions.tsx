import {customerLanguage} from '@/lib/customer-language-server';
import {db} from '@/lib/db';

export async function CustomerPromotions(){
 const {t,locale,date:customerDate,money:customerMoney}=await customerLanguage();
 const now=new Date();
 const rule=await db.crmPointRule.findFirst({where:{effectiveAt:{lte:now}},orderBy:{effectiveAt:'desc'},select:{enabled:true,tierRates:true}});
 const promotions=rule?.enabled&&rule.tierRates?await db.crmPointPromotion.findMany({
  where:{enabled:true,startsAt:{lte:now},endsAt:{gt:now}},
  orderBy:{endsAt:'asc'},
  select:{id:true,name:true,startsAt:true,endsAt:true,minimumSatang:true,bonusType:true,bonusValue:true},
 }):[];

 return <section className="portal-section">
  <div className="portal-section-title"><h2>{t("โปรโมชั่น")}</h2><span>{promotions.length}{t(" รายการ")}</span></div>
  {promotions.length?<>
   <div className="portal-offers">{promotions.map(promotion=><article className="portal-offer" key={promotion.id}>
    <span className="portal-offer-bonus">+{promotion.bonusValue.toLocaleString(locale)}{promotion.bonusType==='PERCENT'?'%':' Green Coin'}</span>
    <h3>{promotion.name}</h3>
    <p>{t("ซื้อครบ ")}{customerMoney(promotion.minimumSatang)}</p>
    {promotion.bonusType==='PERCENT'&&<p>{t("รับโบนัสเพิ่มจาก Green Coin ปกติ")}</p>}
    <small>{customerDate(promotion.startsAt)} – {customerDate(new Date(+promotion.endsAt-1))}</small>
   </article>)}</div>
   <p className="portal-muted">{t("รับโบนัสสูงสุด 1 โปรโมชั่นต่อออเดอร์ เมื่อซื้อสำเร็จตามเงื่อนไข")}</p>
  </>:<div className="portal-empty">{t("ยังไม่มีโปรโมชั่นที่เปิดใช้งาน")}</div>}
 </section>;
}
