import {StoreBrand} from '@/app/store-brand';
import {marketingPending} from '@/lib/customer-marketing';
import {redirect} from 'next/navigation';
import '../../customer/portal.css';

export const dynamic='force-dynamic';

export default async function MarketingConnect({searchParams}:{searchParams:Promise<{error?:string}>}){
 const [params,pending]=await Promise.all([searchParams,marketingPending()]);
 if(pending)redirect('/marketing');
 return <main className="customer-portal"><section className="portal-welcome portal-login-card">
  <div className="portal-login-brand"><StoreBrand fallback="Customer"/></div>
  <h1>เข้าสู่ระบบด้วย LINE</h1>
  <p>{params.error==='expired'?'การเข้าสู่ระบบหมดอายุ กรุณาเริ่มใหม่อีกครั้ง':params.error?'ยังยืนยันตัวตนกับ LINE ไม่สำเร็จ กรุณาลองอีกครั้ง':'เข้าสู่ระบบเพื่อไปยังหน้าลูกค้า'}</p>
  <a className="button portal-line" href="/marketing?fresh=1">เข้าสู่ระบบด้วย LINE</a>
 </section></main>;
}
