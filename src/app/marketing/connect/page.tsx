import {lineSettings} from '@/lib/line-settings';
import {marketingPending} from '@/lib/customer-marketing';
import {redirect} from 'next/navigation';
import '../../customer/portal.css';

export const dynamic='force-dynamic';
export default async function MarketingConnect({searchParams}:{searchParams:Promise<{error?:string}>}){
 const [params,pending,connection]=await Promise.all([searchParams,marketingPending(),lineSettings()]);
 if(!params.error)redirect(pending?'/marketing/recheck':'/marketing');
 const basicId=connection?.settings.basicId;
 const friendUrl=basicId&&/^@[\w.-]+$/.test(basicId)?'https://line.me/R/ti/p/'+encodeURIComponent(basicId):null;
 return <main className="customer-portal"><section className="portal-welcome">
  <h1>เชื่อมต่อ LINE เพื่อเข้า Customer</h1>
  <p>เพิ่มเพื่อน LINE OA ของร้าน แล้วกลับมากดตรวจสอบอีกครั้ง</p>
  {params.error&&<p className="portal-alert" role="alert">{params.error==='unavailable'?'ขณะนี้ยังไม่พร้อมเชื่อมต่อ LINE กรุณาลองใหม่ภายหลัง':params.error==='expired'?'ขั้นตอนเชื่อมต่อหมดอายุ กรุณาเริ่มใหม่':'ยังยืนยันการเชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง'}</p>}
  {friendUrl&&<p><a className="button portal-line" href={friendUrl} target="_blank" rel="noopener noreferrer">เพิ่มเพื่อน LINE OA</a></p>}
  <p><a className="button" href={pending?'/marketing/recheck':'/marketing'}>{pending?'ตรวจสอบอีกครั้ง':'เริ่มเชื่อมต่อ LINE'}</a></p>
  {pending&&<p><a href="/marketing?fresh=1">เริ่มเชื่อมต่อใหม่</a></p>}
 </section></main>;
}
