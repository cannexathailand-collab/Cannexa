'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {customerLanguageCookie,type CustomerLanguage} from '@/lib/customer-language';
export function PublicLanguageSwitch({language}:{language:CustomerLanguage}){
 const [selected,setSelected]=useState(language),router=useRouter();
 function select(value:CustomerLanguage){
  document.cookie=customerLanguageCookie+'='+value+'; Path=/; Max-Age=31536000; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
  setSelected(value);router.refresh();
 }
 return <nav className="actions" aria-label="Language" style={{justifyContent:'flex-end',marginBottom:16}}><button type="button" className="secondary" style={{width:'auto',marginTop:0,padding:'6px 10px'}} lang="th" aria-pressed={selected==='th'} onClick={()=>select('th')}>ไทย</button><button type="button" className="secondary" style={{width:'auto',marginTop:0,padding:'6px 10px'}} lang="en" aria-pressed={selected==='en'} onClick={()=>select('en')}>English</button></nav>;
}
