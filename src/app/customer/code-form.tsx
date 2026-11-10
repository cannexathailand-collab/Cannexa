'use client';
import {useCustomerLanguage} from '@/app/customer/language';

import {useState} from 'react';
export function CustomerCodeForm({customerCode}:{customerCode?:string}){
 const {t}=useCustomerLanguage();
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <form className="portal-profile" onSubmit={async event=>{
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  const code=new FormData(event.currentTarget).get('code');
  try{const response=await fetch('/api/customer/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error);window.location.assign('/customer/password');}
  catch(error){setError(error instanceof Error?error.message:'กรุณาลองใหม่');setBusy(false);}
 }}><label>{t("รหัสลูกค้า")}<input name="code" required maxLength={30} autoCapitalize="characters" autoComplete="off" placeholder={t("เช่น C0001")} defaultValue={customerCode??''}/></label>{customerCode&&<p>{t("บัญชี LINE นี้มีรหัสลูกค้าแล้ว ใช้รหัสนี้เพื่อดำเนินการต่อ")}</p>}{error&&<p className="portal-alert" role="alert">{t(error)}</p>}<button disabled={busy}>{t(busy?'กำลังตรวจสอบ…':'ดำเนินการต่อ')}</button>{!customerCode&&<a href="/customer?register=1">{t("ยังไม่มีรหัสลูกค้า สมัครสมาชิก")}</a>}</form>;
}
