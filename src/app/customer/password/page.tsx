import {redirect} from 'next/navigation';
import {portalCustomer} from '@/lib/customer-portal';
import {cookies} from 'next/headers';
import {readToken} from '@/lib/crypto';
import {CustomerPasswordForm} from './password-form';
import {displayCustomerCode} from '@/lib/customer-code';
import '../portal.css';
export default async function CustomerPasswordPage({searchParams}:{searchParams:Promise<{reset?:string}>}){
 const reset=(await searchParams).reset==='1';
 const {key,customer}=await portalCustomer();
 if(customer?.portalRegistrationPending)redirect('/customer');
 const step=readToken<{purpose:string;key:string;code:string;exp:number}>((await cookies()).get('customer_password_step')?.value??'');
 if(!key||!customer)redirect('/customer');
 if(!reset&&(step?.purpose!=='CUSTOMER_PASSWORD_STEP'||step.key!==key||step.code!==customer.code||step.exp<=Date.now()))redirect('/customer');
 const setup=reset||!customer.portalPasswordHash;
 return <main className="customer-portal"><section className="portal-welcome"><h1>{reset?'ตั้งรหัสผ่านใหม่':setup?'ตั้งรหัสผ่านครั้งแรก':'เข้าสู่ระบบ'}</h1><p>รหัสลูกค้า {displayCustomerCode(customer.code)}</p><CustomerPasswordForm setup={setup} reset={reset}/></section></main>;
}
