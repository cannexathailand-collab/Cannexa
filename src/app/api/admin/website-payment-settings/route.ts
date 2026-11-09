import {admin, sameOrigin} from '@/lib/auth';
import {saveWebsitePaymentSettings} from '@/lib/website-payment-settings';
import {websitePaymentReady} from '@/lib/website-payment';

export async function POST(request: Request) {
  let actor: string;
  try { await sameOrigin(); actor = await admin(); }
  catch { return Response.json({error: 'เฉพาะเจ้าของระบบเท่านั้นที่ตั้งค่าบัญชีรับโอนได้'}, {status: 403}); }
  try {
    const text = await request.text();
    if (text.length > 5000) return Response.json({error: 'ข้อมูลบัญชีรับโอนยาวเกินไป'}, {status: 400});
    const details = await saveWebsitePaymentSettings(actor, JSON.parse(text));
    return Response.json({ok: true, details, ready: websitePaymentReady(details)}, {headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'WEBSITE_PAYMENT_SETTINGS_CONFLICT') return Response.json({error: 'ข้อมูลบัญชีรับโอนเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนแก้ไข', code}, {status: 409});
    if (code === 'INVALID_WEBSITE_PAYMENT_SETTINGS' || error instanceof SyntaxError) return Response.json({error: 'กรอกธนาคาร ชื่อบัญชี และเลขบัญชี 6–30 หลักให้ครบ หรือเว้นว่างทั้งสามช่อง', code: 'INVALID_WEBSITE_PAYMENT_SETTINGS'}, {status: 400});
    return Response.json({error: 'ยังยืนยันผลการบันทึกไม่ได้ กรุณาลองบันทึกข้อมูลเดิมอีกครั้ง'}, {status: 503});
  }
}
