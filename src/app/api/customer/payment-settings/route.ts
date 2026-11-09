import {customerCatalogAccess} from '@/lib/customer-catalog';
import {loadWebsitePaymentSettings} from '@/lib/website-payment-settings';
import {websitePaymentReady, websiteShippingFees} from '@/lib/website-payment';

export async function GET() {
  try {
    const access = await customerCatalogAccess();
    if (access === 'pending') return Response.json({error: 'กำลังรอร้านอนุมัติสมาชิก'}, {status: 403});
    if (!access) return Response.json({error: 'กรุณาเข้าสู่ระบบลูกค้า'}, {status: 401});
    const details = await loadWebsitePaymentSettings();
    return Response.json({details, ready: websitePaymentReady(details), shippingFees: websiteShippingFees}, {headers: {'Cache-Control': 'private, no-store'}});
  } catch {
    return Response.json({error: 'โหลดข้อมูลการชำระเงินไม่สำเร็จ กรุณาลองใหม่'}, {status: 503});
  }
}
