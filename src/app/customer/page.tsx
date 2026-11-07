import type {Metadata} from 'next';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {db} from '@/lib/db';
import {loadCustomerCrm,crmMoney,crmDate} from '@/lib/customer-crm';
import {displayCustomerCode} from '@/lib/customer-code';
import {ProfileForm} from './profile-form';
import './portal.css';
import {CustomerCodeForm} from './code-form';
import {MemberCard} from './member-card';
import {CustomerPanels} from './customer-panels';
export const metadata:Metadata={title:'Customer',description:'ข้อมูลสมาชิก Green Coin และติดตามออเดอร์ของคุณ',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function CustomerPage({searchParams}:{searchParams:Promise<{error?:string;link?:string;register?:string}>}){
 const params=await searchParams;const {key,customer}=await portalCustomer();
 if(customer?.portalRegistrationPending)return <main className="customer-portal"><section className="portal-welcome"><h1>รอร้านอนุมัติสมาชิก</h1><p>รหัสลูกค้า {displayCustomerCode(customer.code)}</p><p>ส่งข้อมูลสมัครเรียบร้อยแล้ว เมื่อร้านอนุมัติ คุณจะเข้าสู่หน้า Customer ได้ด้วยบัญชี LINE นี้</p><a className="button" href="/customer">ตรวจสถานะอีกครั้ง</a></section></main>;
 const link=params.link&&/^[A-Za-z0-9_-]{43}$/.test(params.link)?params.link:null;
 if(key&&!link&&(customer||params.register!=='1')&&(!customer||!await hasPortalAccess(key,customer.code)))return <main className="customer-portal"><section className="portal-welcome"><h1>รหัสลูกค้า</h1>{params.error==='login'&&<p role="alert" className="portal-alert">การเข้าสู่ระบบ LINE หมดอายุหรือไม่สำเร็จ <a href="/api/customer/login">เข้าสู่ระบบด้วย LINE อีกครั้ง</a></p>}<CustomerCodeForm customerCode={customer?displayCustomerCode(customer.code):undefined}/></section></main>;
 const summary=customer?(await loadCustomerCrm([customer.code])).get(customer.code):null;
 const member=customer?await db.crmMembershipReview.findFirst({where:{customerCode:customer.code},orderBy:{month:'desc'},select:{level:true}}):null;
 const memberLevel=member?.level??'Bronze';
 const profileContent=<section className="portal-section"><h2>ข้อมูลส่วนตัว</h2><p className="portal-muted">ใช้สำหรับติดต่อและจัดส่งสินค้า การแก้ไขนี้ไม่เปลี่ยนที่อยู่ของออเดอร์ที่สั่งไปแล้ว</p><ProfileForm registered={!!customer} initial={{title:customer?.title??'คุณ',name:customer?.name??'',phone:customer?.phone??'',address:customer?.address??''}}/></section>;

 return <main className="customer-portal">
  {key&&<header className="portal-header"><a href="/customer" className="portal-brand">Customer</a>{key&&<form action="/api/customer/logout" method="post"><button className="portal-signout">ออกจากระบบ</button></form>}</header>}
  {!key||link?<section className="portal-welcome"><h1>ยินดีต้อนรับ</h1><p>ขอบคุณที่ร่วมเป็นสมาชิกกับเรา</p>{params.error&&<p role="alert" className="portal-alert">{params.error==='unavailable'?'ขณะนี้ยังไม่พร้อมเชื่อมต่อ LINE กรุณาลองอีกครั้ง':params.error==='link'?'ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่จากร้าน':'เข้าสู่ระบบหรือผูกบัญชีไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อร้านหากบัญชีนี้ผูกกับลูกค้าคนอื่นแล้ว'}</p>}<a className="button portal-line" href={'/api/customer/login'+(link?'?link='+encodeURIComponent(link):'')}>{link?'ยืนยันผูกข้อมูลด้วย LINE':'เข้าสู่ระบบด้วย LINE'}</a></section>:<>
   {!customer&&<section className="portal-intro"><span className="portal-eyebrow">MY ACCOUNT</span><h1>ยินดีต้อนรับ</h1><p>กรอกข้อมูลเพื่อรับรหัสลูกค้าและเริ่มใช้งาน</p></section>}
   {customer&&<><div className="portal-member-overview"><MemberCard level={memberLevel} name={[customer.title??'คุณ',customer.name].filter(Boolean).join(' ')||'ลูกค้า'} code={displayCustomerCode(customer.code)}/><section className="portal-coin-balance" aria-label="ยอด Green Coin"><h2>Green Coin</h2><span className="portal-coin-mark" aria-hidden="true">G</span><strong>{(summary?.lifetimePoints??0).toLocaleString('th-TH')}</strong><span>เหรียญสะสม</span></section></div>
   <CustomerPanels profile={profileContent} orders={
   <section className="portal-section"><div className="portal-section-title"><h2>ออเดอร์ของฉัน</h2><span>{summary?.allHistory.length??0} รายการ</span></div>{summary?.allHistory.length?<div className="portal-orders">{summary.allHistory.map(row=><article key={row.order.id} className="portal-order"><header><strong>{row.order.orderNumber}</strong><span className="portal-status">{row.status}</span></header><div className="portal-order-meta"><span>{crmDate(row.order.eventAt)} · {row.order.payment}</span><strong>{row.amountSatang!==null?crmMoney(row.amountSatang):'รอยืนยันยอด'}</strong></div><div className="portal-tracking"><span>เลขพัสดุ</span><strong>{row.tracking??'รอจัดส่ง'}</strong></div></article>)}</div>:<div className="portal-empty">ยังไม่มีออเดอร์<br/><small>แจ้งรหัสลูกค้านี้กับพนักงานเมื่อสั่งซื้อ เพื่อให้แสดงออเดอร์ที่นี่</small></div>}</section>}/></>}
   {!customer&&profileContent}
  </>}
  
 </main>;
}
