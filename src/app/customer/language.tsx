'use client';
import {createContext,useContext,useMemo,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {customerLanguageCookie,customerLanguageTools,type CustomerLanguage} from '@/lib/customer-language';
const LanguageContext=createContext(customerLanguageTools('th'));
export function useCustomerLanguage(){return useContext(LanguageContext);}
export function CustomerLanguageProvider({initialLanguage,children}:{initialLanguage:CustomerLanguage|null;children:ReactNode}){
 const [language,setLanguage]=useState(initialLanguage);
 const router=useRouter();
 const tools=useMemo(()=>customerLanguageTools(language??'th'),[language]);
 function select(next:CustomerLanguage){
  document.cookie=customerLanguageCookie+'='+next+'; Path=/; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
  setLanguage(next);
  router.refresh();
 }
 return <LanguageContext.Provider value={tools}><div lang={language??undefined}>
  {!language?<main className="customer-language-welcome"><h1>เลือกภาษา / Choose your language</h1><p>เลือกภาษาที่ต้องการใช้ / Select your preferred language</p><div className="customer-language-options"><button type="button" lang="th" onClick={()=>select('th')}>ภาษาไทย</button><button type="button" lang="en" onClick={()=>select('en')}>English</button></div></main>:<>
   <nav className="customer-language-switch" aria-label={tools.t('เลือกภาษา')}><span>{tools.t('ภาษา')}</span><button type="button" lang="th" aria-pressed={language==='th'} onClick={()=>select('th')}>ไทย</button><button type="button" lang="en" aria-pressed={language==='en'} onClick={()=>select('en')}>English</button></nav>
   {children}
  </>}
 </div></LanguageContext.Provider>;
}
