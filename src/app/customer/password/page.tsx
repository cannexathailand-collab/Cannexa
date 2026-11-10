import {customerLanguage} from '@/lib/customer-language-server';
import {redirect} from 'next/navigation';
import {portalCustomer} from '@/lib/customer-portal';
import {cookies} from 'next/headers';
import {readToken} from '@/lib/crypto';
import {CustomerPasswordForm} from './password-form';
import {displayCustomerCode} from '@/lib/customer-code';
import '../portal.css';
export default async function CustomerPasswordPage({searchParams}:{searchParams:Promise<{reset?:string}>}){
 const {t}=await customerLanguage();
 const params=await searchParams;
 const {key,customer,method}=await portalCustomer();
 const reset=params.reset==='1'||method==='password';
 if(customer?.portalRegistrationPending)redirect('/customer');
 const step=readToken<{purpose:string;key:string;code:string;exp:number}>((await cookies()).get('customer_password_step')?.value??'');
 if(!method||!customer)redirect('/customer');
 if(!reset&&(step?.purpose!=='CUSTOMER_PASSWORD_STEP'||step.key!==key||step.code!==customer.code||step.exp<=Date.now()))redirect('/customer');
 const setup=reset||!customer.portalPasswordHash;
 return <main className="customer-portal"><section className="portal-welcome"><h1>{t(reset?'ตั้งรหัสผ่านใหม่':setup?'ตั้งรหัสผ่านครั้งแรก':'เข้าสู่ระบบ')}</h1><p>{t("รหัสลูกค้า ")}{(customer.portalUsername||displayCustomerCode(customer.code))}</p><CustomerPasswordForm setup={setup} reset={reset} requiresCurrentPassword={method==='password'}/></section></main>;
}
