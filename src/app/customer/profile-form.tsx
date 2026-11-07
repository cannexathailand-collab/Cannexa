'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function ProfileForm({initial,registered}:{initial:{name:string;phone:string;address:string};registered:boolean}){
 const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 return <form className="portal-profile" onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');setSaved(false);const form=new FormData(event.currentTarget);try{const response=await fetch('/api/customer/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form)),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error||'บันทึกไม่สำเร็จ');if(!registered){window.location.assign(result.pending?'/customer':'/customer/password');return;}setSaved(true);router.refresh();}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ กรุณาลองใหม่');}finally{setBusy(false);}}}>
  <label>ชื่อผู้รับ<input name="name" autoComplete="name" defaultValue={initial.name} maxLength={200} required/></label>
  <label>เบอร์โทร<input name="phone" type="tel" autoComplete="tel" defaultValue={initial.phone} placeholder="0812345678 / 0898765432" required/><small>ใส่ได้ 2 เบอร์ แต่ละเบอร์ 10 หลัก</small></label>
  <label>ที่อยู่จัดส่ง<textarea name="address" autoComplete="street-address" defaultValue={initial.address} rows={4} maxLength={2000} placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด และรหัสไปรษณีย์" required/></label>
  {error&&<p className="portal-alert" role="alert">{error}</p>}{saved&&<p role="status" className="portal-success">บันทึกข้อมูลเรียบร้อยแล้ว</p>}
  <button disabled={busy}>{busy?'กำลังบันทึก…':registered?'บันทึกข้อมูล':'ลงทะเบียนลูกค้า'}</button>
 </form>;
}
