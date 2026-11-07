import type {Metadata} from 'next';
import {CustomerSignInForm} from './sign-in-form';
import '../portal.css';

export const metadata:Metadata={title:'Customer',robots:{index:false,follow:false}};

export default function CustomerSignInPage(){
 return <main className="customer-portal">
  <header className="portal-header"><a className="portal-brand" href="/customer/sign-in">Customer</a></header>
  <section className="portal-welcome">
   <h1>ยินดีต้อนรับ</h1>
   <p>ขอบคุณที่ร่วมเป็นสมาชิกกับเรา</p>
   <CustomerSignInForm/>
   <div className="portal-sign-in-alternative">
    <p>ยังไม่เคยตั้งรหัสผ่าน เข้าผ่าน LINE เพื่อตั้งรหัสผ่านก่อน</p>
    <a className="button portal-line" href="/api/customer/login">เข้าสู่ระบบด้วย LINE</a>
   </div>
  </section>
 </main>;
}
