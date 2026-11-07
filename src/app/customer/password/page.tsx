import {redirect} from 'next/navigation';
import {portalCustomer} from '@/lib/customer-portal';
import {cookies} from 'next/headers';
import {readToken} from '@/lib/crypto';
import {CustomerPasswordForm} from './password-form';
import {displayCustomerCode} from '@/lib/customer-code';
import '../portal.css';
export default async function CustomerPasswordPage(){
 const {key,customer}=await portalCustomer();
 const step=readToken<{purpose:string;key:string;code:string;exp:number}>((await cookies()).get('customer_password_step')?.value??'');
 if(!key||!customer||step?.purpose!=='CUSTOMER_PASSWORD_STEP'||step.key!==key||step.code!==customer.code||step.exp<=Date.now())redirect('/customer');
 const setup=!customer.portalPasswordHash;
 return <main className="customer-portal"><section className="portal-welcome"><h1>{setup?'ตั้งรหัสผ่านครั้งแรก':'เข้าสู่ระบบ'}</h1><p>รหัสลูกค้า {displayCustomerCode(customer.code)}</p><CustomerPasswordForm setup={setup}/></section></main>;
}
