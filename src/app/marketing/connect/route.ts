import {NextRequest, NextResponse} from 'next/server';
import {baseUrl, mockMode} from '@/lib/config';
import {marketingCookie, readMarketingPending} from '@/lib/customer-marketing';
import {lineCustomerDestination} from '@/lib/line-customer-destination';
import {lineSettings} from '@/lib/line-settings';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!request.nextUrl.searchParams.has('error')) {
    const pending = readMarketingPending(request.cookies.get(marketingCookie)?.value ?? '');
    return NextResponse.redirect(baseUrl() + (pending ? '/marketing/recheck' : '/marketing'));
  }

  const connection = mockMode() ? null : await lineSettings();
  if (!connection || !/^@[\w.-]+$/.test(connection.settings.basicId)) {
    return new NextResponse('ขณะนี้ยังไม่พร้อมเชื่อมต่อ LINE กรุณาลองใหม่ภายหลัง', {
      status: 503,
      headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'},
    });
  }

  const response = NextResponse.redirect(lineCustomerDestination(connection.settings.basicId, false));
  response.cookies.delete(marketingCookie);
  return response;
}
