import {cookies} from 'next/headers';
import {customerLanguageCookie,resolveCustomerLanguage} from '@/lib/customer-language';
import {CustomerLanguageProvider} from './language';
import './portal.css';
import localFont from 'next/font/local';

const customerFont=localFont({
 src:'./fonts/noto-sans-thai.ttf',
 variable:'--font-customer',
 display:'swap',
});

const platinumFont=localFont({
 src:'./fonts/cormorant/CormorantGaramond.ttf',
 variable:'--font-platinum',
 display:'swap',
 preload:false,
 weight:'300 700',
});

export default async function CustomerLayout({children}:{children:React.ReactNode}){
 const language=resolveCustomerLanguage((await cookies()).get(customerLanguageCookie)?.value);
 return <div className={customerFont.variable+' '+platinumFont.variable+' customer-shell'}><CustomerLanguageProvider initialLanguage={language}>{children}</CustomerLanguageProvider></div>;
}
