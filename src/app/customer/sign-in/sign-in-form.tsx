'use client';

import {useEffect,useState} from 'react';

export function CustomerSignInForm(){
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>setReady(true),[]);

 return <form className="portal-profile" method="post" action="/api/customer/sign-in" onSubmit={async event=>{
  event.preventDefault();
  if(busy)return;
  const form=new FormData(event.currentTarget);
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/customer/sign-in',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code:form.get('code'),password:form.get('password')}),
    signal:AbortSignal.timeout(15000),
   });
   const result=await response.json().catch(()=>null);
   if(!response.ok||!result?.ok){
    setError(result?.error||'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
    setBusy(false);
    return;
   }
   window.location.assign('/customer');
  }catch{
   setError('เชื่อมต่อไม่สำเร็จ กรุณาลองเข้าสู่ระบบอีกครั้ง');
   setBusy(false);
  }
 }}>
  <label>รหัสลูกค้า<input name="code" maxLength={64} autoComplete="username" autoCapitalize="characters" spellCheck={false}/></label>
  <small>เจ้าของระบบใช้ชื่อผู้ใช้ owner และรหัสผ่านเจ้าของระบบ</small>
  <label>รหัสผ่าน<input name="password" type="password" required maxLength={256} autoComplete="current-password"/></label>
  {error&&<p className="portal-alert" role="alert">{error}</p>}
  <button disabled={!ready||busy}>{busy?'กำลังเข้าสู่ระบบ…':'เข้าสู่ระบบ'}</button>
  <a href="/api/customer/login">ลืมรหัสผ่าน · ยืนยันผ่าน LINE</a>
 </form>;
}
