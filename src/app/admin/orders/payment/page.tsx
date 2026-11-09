import {requireAdminPage} from '@/lib/auth';
import {loadWebsitePaymentSettings} from '@/lib/website-payment-settings';
import {websiteShippingFees} from '@/lib/website-payment';
import {WebsitePaymentForm} from './payment-form';

export const dynamic = 'force-dynamic';

export default async function WebsitePaymentPage() {
  await requireAdminPage();
  const details = await loadWebsitePaymentSettings();
  return <>
    <div className="intro"><div><div className="eyebrow">ออเดอร์ / เว็บไซต์</div><h1>ตั้งค่าการชำระเงิน</h1><p className="muted">บัญชีรับโอนที่แสดงให้ลูกค้าในตะกร้า Shop</p></div></div>
    <section className="card"><h2>บัญชีรับโอน</h2><WebsitePaymentForm initial={details}/></section>
    <section className="card"><h2>ค่าจัดส่ง</h2><p>โอนเงิน {(websiteShippingFees.TRANSFER / 100).toLocaleString('th-TH')} บาท</p><p>เก็บเงินปลายทาง {(websiteShippingFees.COD / 100).toLocaleString('th-TH')} บาท</p></section>
  </>;
}
