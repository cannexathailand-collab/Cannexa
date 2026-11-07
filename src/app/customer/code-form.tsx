'use client';
import {useState} from 'react';
export function CustomerCodeForm(){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <form className="portal-profile" onSubmit={async event=>{
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  const code=new FormData(event.currentTarget).get('code');
  try{const response=await fetch('/api/customer/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error);window.location.assign('/customer/password');}
  catch(error){setError(error instanceof Error?error.message:'กรุณาลองใหม่');setBusy(false);}
 }}><label>รหัสลูกค้า<input name="code" required maxLength={30} autoCapitalize="characters" autoComplete="off" placeholder="เช่น C0001"/></label>{error&&<p className="portal-alert" role="alert">{error}</p>}<button disabled={busy}>{busy?'กำลังตรวจสอบ…':'ดำเนินการต่อ'}</button><a href="/customer?register=1">ยังไม่มีรหัสลูกค้า สมัครสมาชิก</a></form>;
}
