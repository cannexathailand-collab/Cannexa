'use client';
import {createContext,useContext,useMemo,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {customerLanguageCookie,customerLanguageTools,defaultCustomerLanguage,type CustomerLanguage} from '@/lib/customer-language';
const LanguageContext=createContext(customerLanguageTools(defaultCustomerLanguage));
export function useCustomerLanguage(){return useContext(LanguageContext);}
export function CustomerLanguageProvider({initialLanguage,children}:{initialLanguage:CustomerLanguage|null;children:ReactNode}){
 const [language,setLanguage]=useState(initialLanguage??defaultCustomerLanguage);
 const router=useRouter();
 const tools=useMemo(()=>customerLanguageTools(language),[language]);
 function select(next:CustomerLanguage){
  document.cookie=customerLanguageCookie+'='+next+'; Path=/; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
  setLanguage(next);
  router.refresh();
 }
 return <LanguageContext.Provider value={tools}><div lang={language}>
   <nav className="customer-language-switch" aria-label={tools.t('เลือกภาษา')}><span>{tools.t('ภาษา')}</span><button type="button" lang="th" aria-pressed={language==='th'} onClick={()=>select('th')}>ไทย</button><button type="button" lang="en" aria-pressed={language==='en'} onClick={()=>select('en')}>English</button></nav>
   {children}
 </div></LanguageContext.Provider>;
}
