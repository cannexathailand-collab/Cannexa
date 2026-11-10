import {StoreBrand} from '@/app/store-brand';
import {pointTierKey} from '@/lib/crm-tier-points';
import {customerLanguage} from '@/lib/customer-language-server';
import {PopupDetails} from '@/app/popup-details';
import Link from 'next/link';
import {db} from '@/lib/db';
import {canonicalCustomerCode,displayCustomerCode} from '@/lib/customer-code';
import {loadCustomerCrm} from '@/lib/customer-crm';
import {MemberCard} from './member-card';
import {CustomerPanels} from './customer-panels';
import {CustomerOrderHistory} from './order-history';
import {CustomerPromotions} from './promotions';
import {CustomerGreenCoin} from './green-coin';
import {CustomerShop} from './shop';
import {loadCustomerCatalog} from '@/lib/customer-catalog';
import {CustomerWebsiteOrders} from './website-orders';

export async function OwnerCustomerView({params}:{params:{q?:string;customer?:string}}){
 const {t,locale}=await customerLanguage();
 const query=typeof params.q==='string'?params.q.trim().slice(0,100):'';
 const selectedCode=typeof params.customer==='string'&&params.customer.length<=30?canonicalCustomerCode(params.customer):'';
 const [customers,selected]=await Promise.all([
  db.customer.findMany({
   where:query?{OR:[{code:{contains:canonicalCustomerCode(query),mode:'insensitive'}},{name:{contains:query,mode:'insensitive'}},{portalUsername:{contains:query.toLowerCase(),mode:'insensitive'}},{phone:{contains:query}}]}:{},
   select:{code:true,name:true},orderBy:{code:'asc'},take:30,
  }),
  selectedCode?db.customer.findUnique({where:{code:selectedCode},select:{code:true,title:true,name:true,phone:true,address:true,portalRegistrationPending:true,portalUsername:true}}):Promise.resolve(null),
 ]);
 const [summaries,member]=selected?await Promise.all([
  loadCustomerCrm([selected.code]),
  db.crmMembershipReview.findFirst({where:{customerCode:selected.code},orderBy:{month:'desc'},select:{level:true}}),
 ]):[null,null];
 const summary=selected?summaries?.get(selected.code):null;
 const balance=Math.max(0,summary?.availablePoints??0);
 const catalog=selected?await loadCustomerCatalog():null;
 return <main className="customer-portal" data-membership={selected?pointTierKey(member?.level??'Bronze'):undefined}>
  <header className="portal-header"><Link href="/customer" className="portal-brand"><StoreBrand fallback="Customer"/></Link><Link href="/admin">{t("กลับหลังบ้าน")}</Link></header>
  <section className="portal-section">
   <h1>{t("Customer · โหมดเจ้าของระบบ")}</h1>
   <p className="portal-muted">{t("เลือกลูกค้าเพื่อดูข้อมูลแบบอ่านอย่างเดียวและทดลองตะกร้า")}</p>
   <PopupDetails closeOnLink closeLabel={t('ปิด')} summary={<> {t(selected?'เปลี่ยนลูกค้า':'เลือกลูกค้า')} </>}>
   <form action="/customer" className="portal-profile" method="get">
    <label>{t("ค้นหารหัสลูกค้า ชื่อ หรือเบอร์โทร")}<input name="q" defaultValue={query} maxLength={100}/></label>
    <button>{t("ค้นหาลูกค้า")}</button>
   </form>
   <div className="portal-orders" aria-label={t("เลือกลูกค้าที่ต้องการดู")}>{customers.map(customer=><Link className="portal-order" key={customer.code} href={'/customer?'+new URLSearchParams({q:query,customer:customer.code})}>
    <strong>{displayCustomerCode(customer.code)}</strong> · {customer.name??t('ยังไม่ระบุชื่อ')}{t(" · ดูข้อมูล ")}</Link>)}</div>
   {!customers.length&&<p>{t("ไม่พบลูกค้าที่ค้นหา")}</p>}
   {!query&&customers.length===30&&<p className="portal-muted">{t("แสดง 30 รายการแรก พิมพ์ค้นหาเพื่อเลือกลูกค้าที่ต้องการ")}</p>}
   </PopupDetails>
   {selectedCode&&!selected&&<p role="alert">{t("ไม่พบรหัสลูกค้าที่เลือก")}</p>}
   {!selectedCode&&<p>{t("กรุณาเลือกลูกค้าจากรายการ")}</p>}
  </section>
  {selected&&<>
   <p className="portal-muted">{t("กำลังดู ")}{(selected.portalUsername||displayCustomerCode(selected.code))} · {selected.name??t('ยังไม่ระบุชื่อ')}{t(selected.portalRegistrationPending?' · รออนุมัติสมาชิก':'')}</p>
   <div className="portal-member-overview">
    <MemberCard level={member?.level??'Bronze'} name={[selected.title??'คุณ',selected.name].filter(Boolean).join(' ')} code={(selected.portalUsername||displayCustomerCode(selected.code))}/>
    <section className="portal-coin-balance" aria-label={t("ยอด Green Coin")}><h2>Green Coin</h2><span className="portal-coin-mark" aria-hidden="true">G</span><strong>{balance.toLocaleString(locale)}</strong><span>{t("เหรียญคงเหลือ")}</span></section>
   </div>
   <CustomerPanels key={selected.code} readOnly shop={<CustomerShop customerCode={selected.code} initialCatalog={catalog!} readOnly/>} orders={<><CustomerWebsiteOrders customerCode={selected.code}/><CustomerOrderHistory history={summary?.allHistory??[]} title={t("ออเดอร์จัดส่ง")} emptyText={t("ยังไม่มีออเดอร์จัดส่ง")}/></>} profile={
    <section className="portal-section"><h2>{t("ข้อมูลส่วนตัว")}</h2><div className="portal-profile">
     <label>{t("คำนำหน้า")}<input value={selected.title??''} readOnly/></label>
     <label>{t("ชื่อผู้รับ")}<input value={selected.name??''} readOnly/></label>
     <label>{t("เบอร์โทร")}<input value={selected.phone??''} readOnly/></label>
     <label>{t("ที่อยู่จัดส่ง")}<textarea aria-label={t("ที่อยู่จัดส่ง")} value={selected.address??''} readOnly rows={4}/></label>
    </div></section>
   } promotions={<CustomerPromotions/>} coins={<CustomerGreenCoin customerCode={selected.code} balance={balance} readOnly/>}/>
  </>}
 </main>;
}
