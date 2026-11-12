import {cookies} from 'next/headers';
import {customerShopProduct,shopEntryCookie} from '@/lib/customer-shop-link';
import {validContactPhones} from '@/lib/contact-phones';
import {loadCustomerDeliveryAddresses} from '@/lib/customer-delivery-addresses';
import {StoreBrand} from '@/app/store-brand';
import {pointTierKey} from '@/lib/crm-tier-points';
import {customerLanguage} from '@/lib/customer-language-server';
import type {Metadata} from 'next';
import {portalCustomer} from '@/lib/customer-portal';
import {db} from '@/lib/db';
import {loadCustomerCrm} from '@/lib/customer-crm';
import {currentAccount} from '@/lib/auth';
import {displayCustomerCode} from '@/lib/customer-code';
import {ProfileForm} from './profile-form';
import './portal.css';
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
export default async function CustomerPage({searchParams}:{searchParams:Promise<{error?:string;link?:string;register?:string;q?:string;customer?:string;product?:string;tab?:string}>}){
 const {t,locale}=await customerLanguage();
 const params=await searchParams;
 const targetProduct=customerShopProduct(params.product)??customerShopProduct((await cookies()).get(shopEntryCookie)?.value);
 const openShop=params.tab==='shop'||!!targetProduct;
 try{if((await currentAccount()).role==='owner')return <OwnerCustomerView params={params} targetProduct={targetProduct} openShop={openShop}/>;}
 catch(error){if(!(error instanceof Error)||error.message!=='UNAUTHORIZED')throw error;}
 const {key,customer,method,marketingEntry}=await portalCustomer();
 const completing=!!customer&&(!!customer.profileResetAt&&customer.portalProfileIncomplete||!marketingEntry&&(customer.portalProfileIncomplete||!validContactPhones(customer.phone??'')));
 if(customer?.portalRegistrationPending&&!completing)return <main className="customer-portal"><section className="portal-welcome"><h1>{t("รอร้านอนุมัติสมาชิก")}</h1><p>{t("รหัสลูกค้า ")}{(customer.portalUsername||displayCustomerCode(customer.code))}</p><p>{t("ส่งข้อมูลสมัครเรียบร้อยแล้ว เมื่อร้านอนุมัติ คุณจะเข้าสู่หน้า Customer ได้ด้วยบัญชี LINE นี้")}</p><a className="button" href="/customer">{t("ตรวจสถานะอีกครั้ง")}</a></section></main>;
 const link=params.link&&/^[A-Za-z0-9_-]{43}$/.test(params.link)?params.link:null;
 const summary=customer?(await loadCustomerCrm([customer.code])).get(customer.code):null;
 const member=customer?await db.crmMembershipReview.findFirst({where:{customerCode:customer.code},orderBy:{month:'desc'},select:{level:true}}):null;
 const memberLevel=member?.level??'Bronze';
 const catalog=customer&&!completing?await loadCustomerCatalog():null;
 const savedAddresses=customer&&!completing?await loadCustomerDeliveryAddresses(customer.code):[];
 const deliveryPhone=customer?.name&&customer?.address?(savedAddresses.find(address=>address.name===customer.name&&address.address===customer.address)?.phone??customer.phone??''):'';
 const profileContent=<section className={completing?"portal-section portal-phone-registration":"portal-section portal-profile-section"}><h2>{t(completing?"ระบุเบอร์โทรศัพท์":"ข้อมูลส่วนตัว")}</h2><p className="portal-muted">{t(completing?"ระบุเบอร์โทรติดต่อเพื่อเริ่มใช้งาน":"ใช้สำหรับติดต่อและจัดส่งสินค้า การแก้ไขนี้ไม่เปลี่ยนที่อยู่ของออเดอร์ที่สั่งไปแล้ว")}</p><ProfileForm savedAddresses={savedAddresses} registered={!!customer&&!completing} completeProfile={completing} initial={{businessLicenseNumber:customer?.businessLicenseNumber??'',customerCategory:customer?.customerCategory??'',username:customer?.portalUsername??'',discoverySource:customer?.discoverySource??'',title:customer?.title??'คุณ',name:customer?.name??'',phone:completing?(customer?.phone??''):deliveryPhone,address:customer?.address??''}}/></section>;

 return <main className="customer-portal" data-membership={pointTierKey(memberLevel)}>
  {method&&!link&&<header className="portal-header"><a href="/customer" className="portal-brand"><StoreBrand fallback="Customer"/></a>{method&&<form action="/api/customer/logout" method="post"><button className="portal-signout">{t("ออกจากระบบ")}</button></form>}</header>}
  {!method||link?<section className="portal-welcome portal-login-card"><div className="portal-login-brand"><a className="portal-brand" href="/customer"><StoreBrand fallback="Customer"><span className="portal-login-welcome">{t("ยินดีต้อนรับ")}</span><span className="portal-login-tagline">{t("ขอบคุณที่ร่วมเป็นสมาชิกกับเรา")}</span></StoreBrand></a></div>{params.error&&<p role="alert" className="portal-alert">{t(params.error==='unavailable'?'ขณะนี้ยังไม่พร้อมเชื่อมต่อ LINE กรุณาลองอีกครั้ง':params.error==='link'?'ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่จากร้าน':'เข้าสู่ระบบหรือผูกบัญชีไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อร้านหากบัญชีนี้ผูกกับลูกค้าคนอื่นแล้ว')}</p>}<a className="button portal-line" href={'/api/customer/login'+(link?'?link='+encodeURIComponent(link):'')}>{t(link?'ยืนยันผูกข้อมูลด้วย LINE':'เข้าสู่ระบบด้วย LINE')}</a>{!link&&<p><a href="/customer/sign-in">{t("เข้าสู่ระบบด้วยรหัสลูกค้า")}</a></p>}</section>:<>
   {customer&&!completing&&<><div className="portal-member-overview"><MemberCard level={memberLevel} name={customer.name?[customer.title??'คุณ',customer.name].filter(Boolean).join(' '):t('ลูกค้า')} code={(customer.portalUsername||displayCustomerCode(customer.code))}/><section className="portal-coin-balance" aria-label={t("ยอด Green Coin")}><h2>Green Coin</h2><span className="portal-coin-mark" aria-hidden="true">G</span><strong>{Math.max(0,summary?.availablePoints??0).toLocaleString(locale)}</strong><span>{t("เหรียญคงเหลือ")}</span></section></div>
   <CustomerPanels openShop={openShop} shopTarget={targetProduct} passwordRequiresCurrent={method==='password'} shop={<CustomerShop targetProduct={targetProduct} customerCode={customer.code} profileVersion={customer.profileResetAt?.toISOString()} initialCatalog={catalog!} initialDelivery={{name:customer.name??'',address:customer.address??'',phone:deliveryPhone}} savedAddresses={savedAddresses}/>} profile={profileContent} promotions={<CustomerPromotions/>} coins={<CustomerGreenCoin customerCode={customer.code} balance={Math.max(0,summary?.availablePoints??0)}/>} orders={<><CustomerWebsiteOrders customerCode={customer.code}/><CustomerOrderHistory history={summary?.allHistory??[]} title={t("ออเดอร์จัดส่ง")} emptyText={t("ยังไม่มีออเดอร์จัดส่ง")}/></>}/></>}
   {(!customer||completing)&&profileContent}
  </>}

 </main>;
}
