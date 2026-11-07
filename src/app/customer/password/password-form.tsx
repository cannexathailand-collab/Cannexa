'use client';
import {useEffect,useState} from 'react';
export function CustomerPasswordForm({setup,reset=false}:{setup:boolean;reset?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [ready,setReady]=useState(false);
 useEffect(()=>setReady(true),[]);
 return <form className="portal-profile" method="post" action="/api/customer/password" onSubmit={async event=>{
  event.preventDefault();if(busy)return;setBusy(true);setError('');const form=new FormData(event.currentTarget);
  try{const response=await fetch('/api/customer/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:form.get('password'),confirmation:form.get('confirmation'),reset}),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.error);window.location.assign('/customer');}
  catch(error){setError(error instanceof Error?error.message:'กรุณาลองใหม่');setBusy(false);}
 }}><label>{setup?'ตั้งรหัสผ่าน':'รหัสผ่าน'}<input type="password" name="password" required minLength={setup?4:undefined} maxLength={256} autoComplete={setup?'new-password':'current-password'}/></label>{setup&&<><small>อย่างน้อย 4 ตัวอักษร</small><label>ยืนยันรหัสผ่าน<input type="password" name="confirmation" required minLength={4} maxLength={256} autoComplete="new-password"/></label></>}{error&&<p className="portal-alert" role="alert">{error}</p>}<button disabled={!ready||busy}>{busy?'กำลังตรวจสอบ…':setup?'บันทึกรหัสผ่าน':'เข้าสู่ระบบ'}</button>{!setup&&<a href="/customer/password?reset=1">ลืมรหัสผ่าน</a>}<a href="/customer">กลับไปกรอกรหัสลูกค้า</a></form>;
}
