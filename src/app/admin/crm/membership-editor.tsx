'use client';
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';

export function MembershipEditor({code,level,locked}:{code:string;level:string;locked:boolean}){
 const router=useRouter(),saving=useRef(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(saving.current)return;
  const fields=new FormData(event.currentTarget);
  saving.current=true;setBusy(true);setMessage('');setError('');
  try{
   const response=await fetch('/api/admin/customers',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,level:fields.get('level'),keepLevel:fields.has('keepLevel')})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'บันทึกระดับสมาชิกไม่สำเร็จ');
   setMessage(result.customer.locked?'บันทึกแล้ว · คงระดับสมาชิกถาวร':'บันทึกแล้ว · รอบถัดไปประเมินตามเกณฑ์สมาชิก');
   router.refresh();
  }catch(failure){setError(failure instanceof Error?failure.message:'บันทึกระดับสมาชิกไม่สำเร็จ');}
  finally{saving.current=false;setBusy(false);}
 }
 return <section className="card" aria-label="จัดการระดับสมาชิก">
  <h2>จัดการระดับสมาชิก</h2>
  <p>{locked?'สมาชิกพิเศษ · คงระดับถาวร':'ประเมินระดับตามเกณฑ์รายเดือน'}</p>
  <form onSubmit={save}>
   <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
    <label>ระดับสมาชิก<select name="level" defaultValue={level} key={level}>{['ลูกค้าใหม่','ยังไม่เข้าเกณฑ์','Bronze','Silver','Gold','VIP Platinum'].map(name=><option key={name}>{name}</option>)}</select></label>
    <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" name="keepLevel" defaultChecked={locked} key={String(locked)} style={{width:'auto'}}/>คงระดับสมาชิกถาวร</label>
    <p className="muted small">คงระดับที่กำหนดจนกว่าจะเปลี่ยนหรือปลดล็อก ยกเลิกเครื่องหมายเพื่อกลับไปประเมินตามเกณฑ์ในรอบถัดไป</p>
    <button type="submit">{busy?'กำลังบันทึก…':'บันทึกระดับสมาชิก'}</button>
   </fieldset>
  </form>
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
