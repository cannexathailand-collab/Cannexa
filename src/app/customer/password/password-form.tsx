'use client';
import {useState} from 'react';
export function CustomerPasswordForm({setup}:{setup:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <form className="portal-profile" onSubmit={async event=>{
  event.preventDefault();if(busy)return;setBusy(true);setError('');const form=new FormData(event.currentTarget);
  try{const response=await fetch('/api/customer/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:form.get('password'),confirmation:form.get('confirmation')}),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.error);window.location.assign('/customer');}
  catch(error){setError(error instanceof Error?error.message:'กรุณาลองใหม่');setBusy(false);}
 }}><label>{setup?'ตั้งรหัสผ่าน':'รหัสผ่าน'}<input type="password" name="password" required minLength={setup?8:undefined} maxLength={256} autoComplete={setup?'new-password':'current-password'}/></label>{setup&&<><small>อย่างน้อย 8 ตัวอักษร</small><label>ยืนยันรหัสผ่าน<input type="password" name="confirmation" required minLength={8} maxLength={256} autoComplete="new-password"/></label></>}{error&&<p className="portal-alert" role="alert">{error}</p>}<button disabled={busy}>{busy?'กำลังตรวจสอบ…':setup?'บันทึกรหัสผ่าน':'เข้าสู่ระบบ'}</button><a href="/customer">กลับไปกรอกรหัสลูกค้า</a></form>;
}
