import {StoreBrand} from '@/app/store-brand';
import {customerLanguage} from '@/lib/customer-language-server';
import type {Metadata} from 'next';
import {CustomerSignInForm} from './sign-in-form';
import '../portal.css';

export const metadata:Metadata={title:'Customer',robots:{index:false,follow:false}};

export default async function CustomerSignInPage(){
 const {t}=await customerLanguage();
 return <main className="customer-portal">
  <section className="portal-welcome portal-login-card">
   <div className="portal-login-brand"><a className="portal-brand" href="/customer/sign-in"><StoreBrand fallback="Customer"><span className="portal-login-welcome">{t("ยินดีต้อนรับ")}</span><span className="portal-login-tagline">{t("ขอบคุณที่ร่วมเป็นสมาชิกกับเรา")}</span></StoreBrand></a></div>
   <CustomerSignInForm/>
   <div className="portal-sign-in-alternative">
    <a className="button portal-line" href="/api/customer/login">{t("เข้าสู่ระบบด้วย LINE")}</a>
    <a className="button portal-line portal-line-qr" href="/api/customer/login?qr=1">{t("เข้าสู่ระบบด้วยบัญชีอื่น — สแกน QR Code")}</a>
   </div>
  </section>
 </main>;
}
