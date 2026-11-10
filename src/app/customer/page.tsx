import {pointTierKey} from '@/lib/crm-tier-points';
import {customerLanguage} from '@/lib/customer-language-server';
import type {Metadata} from 'next';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {db} from '@/lib/db';
import {loadCustomerCrm} from '@/lib/customer-crm';
import {currentAccount} from '@/lib/auth';
import {displayCustomerCode} from '@/lib/customer-code';
import {ProfileForm} from './profile-form';
import './portal.css';
import {CustomerCodeForm} from './code-form';
import {MemberCard} from './member-card';
import {CustomerPanels} from './customer-panels';
import {CustomerPromotions} from './promotions';
import {CustomerGreenCoin} from './green-coin';
import {CustomerOrderHistory} from './order-history';
import {OwnerCustomerView} from './owner-customer-view';
import {CustomerShop} from './shop';
import {loadCustomerCatalog} from '@/lib/customer-catalog';
import {CustomerWebsiteOrders} from './website-orders';
export const metadata:Metadata={title:'Customer',description:'ข้อมูลสมาชิก Green Coin และติดตามออเดอร์ของคุณ',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function CustomerPage({searchParams}:{searchParams:Promise<{error?:string;link?:string;register?:string;q?:string;customer?:string}>}){
 const {t,locale}=await customerLanguage();
 const params=await searchParams;
 try{if((await currentAccount()).role==='owner')return <OwnerCustomerView params={params}/>;}
 catch(error){if(!(error instanceof Error)||error.message!=='UNAUTHORIZED')throw error;}
 const {key,customer,method}=await portalCustomer();
 const completing=method==='line'&&!!customer?.portalProfileIncomplete;
 if(customer?.portalRegistrationPending&&!completing)return <main className="customer-portal"><section className="portal-welcome"><h1>{t("รอร้านอนุมัติสมาชิก")}</h1><p>{t("รหัสลูกค้า ")}{displayCustomerCode(customer.code)}</p><p>{t("ส่งข้อมูลสมัครเรียบร้อยแล้ว เมื่อร้านอนุมัติ คุณจะเข้าสู่หน้า Customer ได้ด้วยบัญชี LINE นี้")}</p><a className="button" href="/customer">{t("ตรวจสถานะอีกครั้ง")}</a></section></main>;
 const link=params.link&&/^[A-Za-z0-9_-]{43}$/.test(params.link)?params.link:null;
 if(key&&!link&&!completing&&(customer||params.register!=='1')&&(!customer||!await hasPortalAccess(key,customer.code)))return <main className="customer-portal"><section className="portal-welcome"><h1>{t("รหัสลูกค้า")}</h1>{params.error==='login'&&<p role="alert" className="portal-alert">{t("การเข้าสู่ระบบ LINE หมดอายุหรือไม่สำเร็จ ")}<a href="/api/customer/login">{t("เข้าสู่ระบบด้วย LINE อีกครั้ง")}</a></p>}<CustomerCodeForm customerCode={customer?displayCustomerCode(customer.code):undefined}/></section></main>;
 const summary=customer?(await loadCustomerCrm([customer.code])).get(customer.code):null;
 const member=customer?await db.crmMembershipReview.findFirst({where:{customerCode:customer.code},orderBy:{month:'desc'},select:{level:true}}):null;
 const memberLevel=member?.level??'Bronze';
 const catalog=customer&&!completing?await loadCustomerCatalog():null;
 const profileContent=<section className="portal-section"><h2>{t("ข้อมูลส่วนตัว")}</h2><p className="portal-muted">{t("ใช้สำหรับติดต่อและจัดส่งสินค้า การแก้ไขนี้ไม่เปลี่ยนที่อยู่ของออเดอร์ที่สั่งไปแล้ว")}</p><ProfileForm registered={!!customer&&!completing} completeProfile={completing} initial={{title:customer?.title??'คุณ',name:customer?.name??'',phone:customer?.phone??'',address:customer?.address??''}}/></section>;

 return <main className="customer-portal" data-membership={pointTierKey(memberLevel)}>
  {method&&<header className="portal-header"><a href="/customer" className="portal-brand">Customer</a><form action="/api/customer/logout" method="post"><button className="portal-signout">{t("ออกจากระบบ")}</button></form></header>}
  {!method||link?<section className="portal-welcome"><h1>{t("ยินดีต้อนรับ")}</h1><p>{t("ขอบคุณที่ร่วมเป็นสมาชิกกับเรา")}</p>{params.error&&<p role="alert" className="portal-alert">{t(params.error==='unavailable'?'ขณะนี้ยังไม่พร้อมเชื่อมต่อ LINE กรุณาลองอีกครั้ง':params.error==='link'?'ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่จากร้าน':'เข้าสู่ระบบหรือผูกบัญชีไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อร้านหากบัญชีนี้ผูกกับลูกค้าคนอื่นแล้ว')}</p>}<a className="button portal-line" href={'/api/customer/login'+(link?'?link='+encodeURIComponent(link):'')}>{t(link?'ยืนยันผูกข้อมูลด้วย LINE':'เข้าสู่ระบบด้วย LINE')}</a>{!link&&<p><a href="/customer/sign-in">{t("เข้าสู่ระบบด้วยรหัสลูกค้า")}</a></p>}</section>:<>
   {(!customer||completing)&&<section className="portal-intro"><span className="portal-eyebrow">MY ACCOUNT</span><h1>{t("ยินดีต้อนรับ")}</h1><p>{t(completing?'กรอกข้อมูลสมัครสมาชิก รหัสลูกค้า '+displayCustomerCode(customer!.code):'กรอกข้อมูลเพื่อรับรหัสลูกค้าและเริ่มใช้งาน')}</p></section>}
   {customer&&!completing&&<><div className="portal-member-overview"><MemberCard level={memberLevel} name={[customer.title??'คุณ',customer.name].filter(Boolean).join(' ')||'ลูกค้า'} code={displayCustomerCode(customer.code)}/><section className="portal-coin-balance" aria-label={t("ยอด Green Coin")}><h2>Green Coin</h2><span className="portal-coin-mark" aria-hidden="true">G</span><strong>{Math.max(0,summary?.availablePoints??0).toLocaleString(locale)}</strong><span>{t("เหรียญคงเหลือ")}</span></section></div>
   <CustomerPanels passwordRequiresCurrent={method==='password'} shop={<CustomerShop customerCode={customer.code} initialCatalog={catalog!}/>} profile={profileContent} promotions={<CustomerPromotions/>} coins={<CustomerGreenCoin customerCode={customer.code} balance={Math.max(0,summary?.availablePoints??0)}/>} orders={<><CustomerWebsiteOrders customerCode={customer.code}/><CustomerOrderHistory history={summary?.allHistory??[]} title={t("ออเดอร์จัดส่ง")} emptyText={t("ยังไม่มีออเดอร์จัดส่ง")}/></>}/></>}
   {(!customer||completing)&&profileContent}
  </>}

 </main>;
}
