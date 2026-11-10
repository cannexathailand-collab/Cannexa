import {NextResponse} from 'next/server';
import {cookieOptions,sameOrigin} from '@/lib/auth';
import {baseUrl} from '@/lib/config';
import {customerAgeChallenge,customerAgeCookie} from '@/lib/customer-age';
import {sha} from '@/lib/crypto';
import {clearMarketingCustomerSessions,completeCustomerMarketing,marketingCookie} from '@/lib/customer-marketing';
import {portalAccessCookie,portalAccessToken,portalCookie,portalDuration,portalToken} from '@/lib/customer-portal';

export async function POST(request: Request) {
  try {
    await sameOrigin();
  } catch {
    return new Response('Forbidden', {status: 403});
  }

  const challenge = await customerAgeChallenge();
  if (!challenge) {
    const response = NextResponse.redirect(baseUrl() + '/customer/age?error=expired', 303);
    response.cookies.delete(customerAgeCookie);
    return response;
  }

  let form: URLSearchParams;
  try {
    const body = await request.text();
    if (body.length > 2000) throw Error();
    form = new URLSearchParams(body);
  } catch {
    return new Response('Bad request', {status: 400});
  }

  const answer = form.get('answer');
  if ((answer !== 'yes' && answer !== 'no') || form.get('challenge') !== sha(challenge.value)) {
    return NextResponse.redirect(baseUrl() + '/customer/age?error=changed', 303);
  }
  if (answer === 'no') {
    const response = NextResponse.redirect(baseUrl() + '/customer/age?denied=1', 303);
    clearMarketingCustomerSessions(response);
    response.cookies.delete(marketingCookie);
    return response;
  }

  try {
    const customer = await completeCustomerMarketing(challenge.claims.clickId, challenge.claims.key, {
      id: challenge.claims.conversionId,
    });
    const response = NextResponse.redirect(baseUrl() + '/customer', 303);
    clearMarketingCustomerSessions(response);
    response.cookies.delete(marketingCookie);
    response.cookies.set(portalCookie, portalToken(challenge.claims.key,'marketing'), {...cookieOptions, maxAge: portalDuration});
    if (!customer.portalRegistrationPending && !customer.portalProfileIncomplete) {
      response.cookies.set(portalAccessCookie, portalAccessToken(challenge.claims.key, customer.code), {
        ...cookieOptions, maxAge: portalDuration,
      });
    }
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (!['INVALID_MARKETING_CLICK', 'INVALID_MARKETING_CONVERSION', 'LINK_CONFLICT'].includes(code)) {
      return new Response('บันทึกคำยืนยันไม่สำเร็จ กรุณากลับไปลองอีกครั้ง', {
        status: 503,
        headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'},
      });
    }
    const response = NextResponse.redirect(baseUrl() + '/customer/age?error=expired', 303);
    clearMarketingCustomerSessions(response);
    response.cookies.delete(marketingCookie);
    return response;
  }
}
