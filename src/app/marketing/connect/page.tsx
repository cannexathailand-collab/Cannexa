import {StoreBrand} from '@/app/store-brand';
import {marketingPending} from '@/lib/customer-marketing';
import {lineCustomerDestination} from '@/lib/line-customer-destination';
import {lineSettings} from '@/lib/line-settings';
import '../../customer/portal.css';

export const dynamic='force-dynamic';

export default async function MarketingConnect({searchParams}:{searchParams:Promise<{error?:string}>}){
 const [params,pending,connection]=await Promise.all([searchParams,marketingPending(),lineSettings()]);
 const available=connection&&/^@[\w.-]+$/.test(connection.settings.basicId);
 return <main className="customer-portal"><section className="portal-welcome portal-login-card">
  <div className="portal-login-brand"><StoreBrand fallback="Customer"/></div>
  <h1>{pending?'ยืนยันการเพิ่มเพื่อน LINE':'เชื่อมต่อ LINE'}</h1>
  {!available?<p role="alert">ขณะนี้ยังไม่พร้อมเชื่อมต่อ LINE กรุณาลองใหม่ภายหลัง</p>:<>
   <p>{params.error==='login'?'ยังยืนยันการเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง':pending?'เพิ่มเพื่อน LINE ของร้าน แล้วกดตรวจสอบเพื่อเข้าใช้งาน':'กรุณาเข้าสู่ระบบด้วย LINE เพื่อเข้าใช้งาน'}</p>
   {pending&&<a className="button portal-line" href={lineCustomerDestination(connection.settings.basicId,false)} target="_blank" rel="noopener noreferrer">เพิ่มเพื่อน LINE ร้าน</a>}
   <p><a className="button" href={pending?'/marketing/recheck':'/marketing?fresh=1'}>{pending?'เพิ่มเพื่อนแล้ว ตรวจสอบอีกครั้ง':'เข้าสู่ระบบด้วย LINE'}</a></p>
   {pending&&<p><a href="/marketing?fresh=1">เข้าสู่ระบบด้วยบัญชี LINE อื่น</a></p>}
  </>}
 </section></main>;
}
