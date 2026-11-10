'use client';
import {useState} from 'react';
import {customerLanguageTools,type CustomerLanguage} from '@/lib/customer-language';
export function CopyOrderShipping({text,label='คัดลอกข้อมูลจัดส่ง',successMessage='คัดลอกข้อมูลออเดอร์แล้ว',language='th'}:{text:string;label?:string;successMessage?:string;language?:CustomerLanguage}){
 const {t}=customerLanguageTools(language);
 const [copied,setCopied]=useState(false),[manual,setManual]=useState(false);
 return <div className="order-shipping-copy"><button type="button" onClick={async()=>{
  try{await navigator.clipboard.writeText(text);setCopied(true);setManual(false);}
  catch{setCopied(false);setManual(true);}
 }}>{t(copied?'คัดลอกแล้ว ✓':label)}</button>{copied&&<p role="status">{t(successMessage)}</p>}{manual&&<label>{t('เลือกข้อความเพื่อคัดลอก')}<textarea readOnly value={text} rows={10} onFocus={event=>event.currentTarget.select()}/></label>}</div>;
}
