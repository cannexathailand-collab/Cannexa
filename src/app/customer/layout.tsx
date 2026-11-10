import {cookies} from 'next/headers';
import {customerLanguageCookie,readCustomerLanguage} from '@/lib/customer-language';
import {CustomerLanguageProvider} from './language';
import './portal.css';
import localFont from 'next/font/local';

const customerFont=localFont({
 src:'./fonts/noto-sans-thai.ttf',
 variable:'--font-customer',
 display:'swap',
});

export default async function CustomerLayout({children}:{children:React.ReactNode}){
 const language=readCustomerLanguage((await cookies()).get(customerLanguageCookie)?.value);
 return <div className={customerFont.variable+' customer-shell'}><CustomerLanguageProvider initialLanguage={language}>{children}</CustomerLanguageProvider></div>;
}
