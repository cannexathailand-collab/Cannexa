import type {Metadata} from 'next';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {db} from '@/lib/db';
import {loadCustomerCrm,crmMoney,crmDate} from '@/lib/customer-crm';
import {displayCustomerCode} from '@/lib/customer-code';
import {ProfileForm} from './profile-form';
import './portal.css';
import {CustomerCodeForm} from './code-form';
export const metadata:Metadata={title:'พื้นที่ลูกค้า',description:'ข้อมูลสมาชิก Green Coin และติดตามออเดอร์ของคุณ',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function CustomerPage({searchParams}:{searchParams:Promise<{error?:string;link?:string;register?:string}>}){
 const params=await searchParams;const {key,customer}=await portalCustomer();
 if(customer?.portalRegistrationPending)return <main className="customer-portal"><section className="portal-welcome"><h1>รอร้านอนุมัติสมาชิก</h1><p>รหัสลูกค้า {displayCustomerCode(customer.code)}</p><p>ส่งข้อมูลสมัครเรียบร้อยแล้ว เมื่อร้านอนุมัติ คุณจะใช้รหัสนี้เพื่อตั้งรหัสผ่านและเข้าใช้งานได้</p><a className="button" href="/customer">ตรวจสถานะอีกครั้ง</a></section></main>;
 const link=params.link&&/^[A-Za-z0-9_-]{43}$/.test(params.link)?params.link:null;
 if(key&&!link&&(customer||params.register!=='1')&&(!customer||!await hasPortalAccess(key,customer.code)))return <main className="customer-portal"><section className="portal-welcome"><h1>รหัสลูกค้า</h1><CustomerCodeForm/></section></main>;
 const summary=customer?(await loadCustomerCrm([customer.code])).get(customer.code):null;
 const member=customer?await db.crmMembershipReview.findFirst({where:{customerCode:customer.code},orderBy:{month:'desc'},select:{level:true}}):null;
 return <main className="customer-portal">
  {key&&<header className="portal-header"><a href="/customer" className="portal-brand">พื้นที่ลูกค้า</a>{key&&<form action="/api/customer/logout" method="post"><button className="portal-signout">ออกจากระบบ</button></form>}</header>}
  {!key||link?<section className="portal-welcome"><h1>ยินดีต้อนรับ</h1><p>ขอบคุณที่ร่วมเป็นสมาชิกกับเรา</p>{params.error&&<p role="alert" className="portal-alert">{params.error==='unavailable'?'ขณะนี้ยังไม่พร้อมเชื่อมต่อ LINE กรุณาลองอีกครั้ง':params.error==='link'?'ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่จากร้าน':'เข้าสู่ระบบหรือผูกบัญชีไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อร้านหากบัญชีนี้ผูกกับลูกค้าคนอื่นแล้ว'}</p>}<a className="button portal-line" href={'/api/customer/login'+(link?'?link='+encodeURIComponent(link):'')}>{link?'ยืนยันผูกข้อมูลด้วย LINE':'เข้าสู่ระบบด้วย LINE'}</a></section>:<>
   <section className="portal-intro"><span className="portal-eyebrow">MY ACCOUNT</span><h1>{customer?.name?'สวัสดี คุณ'+customer.name:'ยินดีต้อนรับ'}</h1><p>{customer?'ข้อมูลสมาชิกและออเดอร์ของคุณ':'กรอกข้อมูลเพื่อรับรหัสลูกค้าและเริ่มใช้งาน'}</p></section>
   {customer&&<><section className="portal-stats" aria-label="ข้อมูลสมาชิก"><div><span>รหัสลูกค้า</span><strong>{displayCustomerCode(customer.code)}</strong></div><div><span>Member</span><strong>{member?.level??'ลูกค้าใหม่'}</strong></div><div className="portal-coins"><span>Green Coin</span><strong>{(summary?.lifetimePoints??0).toLocaleString('th-TH')}</strong></div></section>
   <nav className="portal-tabs" aria-label="เมนูลูกค้า"><a href="#orders">ออเดอร์ของฉัน</a><a href="#profile">ข้อมูลส่วนตัว</a><a href="/customer/password?reset=1">เปลี่ยนรหัสผ่าน</a></nav>
   <section id="orders" className="portal-section"><div className="portal-section-title"><h2>ออเดอร์ของฉัน</h2><span>{summary?.allHistory.length??0} รายการ</span></div>{summary?.allHistory.length?<div className="portal-orders">{summary.allHistory.map(row=><article key={row.order.id} className="portal-order"><header><strong>{row.order.orderNumber}</strong><span className="portal-status">{row.status}</span></header><div className="portal-order-meta"><span>{crmDate(row.order.eventAt)} · {row.order.payment}</span><strong>{row.amountSatang!==null?crmMoney(row.amountSatang):'รอยืนยันยอด'}</strong></div><div className="portal-tracking"><span>เลขพัสดุ</span><strong>{row.tracking??'รอจัดส่ง'}</strong></div></article>)}</div>:<div className="portal-empty">ยังไม่มีออเดอร์<br/><small>แจ้งรหัสลูกค้านี้กับพนักงานเมื่อสั่งซื้อ เพื่อให้แสดงออเดอร์ที่นี่</small></div>}</section></>}
   <section id="profile" className="portal-section"><h2>ข้อมูลส่วนตัว</h2><p className="portal-muted">ใช้สำหรับติดต่อและจัดส่งสินค้า การแก้ไขนี้ไม่เปลี่ยนที่อยู่ของออเดอร์ที่สั่งไปแล้ว</p><ProfileForm registered={!!customer} initial={{name:customer?.name??'',phone:customer?.phone??'',address:customer?.address??''}}/></section>
  </>}
  
 </main>;
}
