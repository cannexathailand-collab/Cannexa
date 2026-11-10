'use client';
import Link from 'next/link';
import {useRef,useState,type FormEvent} from 'react';
import {canonicalCustomerCode} from '@/lib/customer-code';

type Customer={code:string;name:string;level:string;locked:boolean};
type Duplicate={code:string;name:string};
export function AdminCustomerRegistrationForm(){
 const submitting=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [customer,setCustomer]=useState<Customer|null>(null),[duplicates,setDuplicates]=useState<Duplicate[]>([]);
 const [message,setMessage]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(submitting.current)return;
  const form=event.currentTarget,fields=new FormData(form);
  const data={name:fields.get('name'),phone:fields.get('phone'),address:fields.get('address'),level:fields.get('level'),password:fields.get('password'),confirmation:fields.get('confirmation'),keepLevel:fields.has('keepLevel')};
  if(data.password!==data.confirmation){setError('รหัสผ่านและช่องยืนยันไม่ตรงกัน');return;}
  submitting.current=true;setBusy(true);setError('');setDuplicates([]);setMessage('');
  try{
   const response=await fetch('/api/admin/customers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const result=await response.json();
   if(response.status===409&&Array.isArray(result.customers)){
    setDuplicates(result.customers);setError('เบอร์นี้มีรหัสลูกค้าอยู่แล้ว กรุณาเปิดข้อมูลเดิม');return;
   }
   if(!response.ok)throw Error(result.error||'บันทึกสมาชิกไม่สำเร็จ');
   setCustomer(result.customer);form.reset();
  }catch(failure){setError(failure instanceof Error?failure.message:'บันทึกสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง');}
  finally{submitting.current=false;setBusy(false);}
 }
 if(customer)return <section className="card" aria-label="สร้างสมาชิกสำเร็จ" style={{maxWidth:820}}>
  <h2>สร้างสมาชิกสำเร็จ</h2>
  <p>{customer.name} · {customer.level}{customer.locked?' · คงระดับถาวร':''}</p>
  <label>รหัสลูกค้า<input value={customer.code} readOnly onFocus={event=>event.currentTarget.select()}/></label>
  <p>ส่งรหัสลูกค้านี้พร้อมรหัสผ่านที่คุณตั้งไว้ให้ลูกค้า ใช้เข้าสู่หน้าลูกค้าได้ทันที</p>
  <div className="filters">
   <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText('รหัสลูกค้า '+customer.code+'\nเข้าสู่ระบบ '+window.location.origin+'/customer/sign-in');setMessage('คัดลอกรหัสลูกค้าและลิงก์แล้ว');}catch{setMessage('กรุณาคัดลอกรหัสจากช่องด้านบน');}}}>คัดลอกรหัสและลิงก์เข้าสู่ระบบ</button>
   <Link className="button secondary" href={'/admin/crm/'+encodeURIComponent(canonicalCustomerCode(customer.code))}>ดูข้อมูลลูกค้า</Link>
   <button type="button" className="secondary" onClick={()=>{setCustomer(null);setMessage('');}}>สร้างสมาชิกคนถัดไป</button>
  </div>
  {message&&<p role="status">{message}</p>}
 </section>;
 return <section className="card" style={{maxWidth:820}}>
  <form onSubmit={submit} className="form-grid" aria-label="สมัครสมาชิกให้ลูกค้า">
   <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0,gridColumn:'1/-1'}}>
    <label>ชื่อลูกค้า<input name="name" required maxLength={200} autoComplete="name"/></label>
    <label>เบอร์โทร<input name="phone" required maxLength={40} inputMode="tel" autoComplete="tel"/></label>
    <label>ที่อยู่จัดส่งพร้อมรหัสไปรษณีย์<textarea name="address" required maxLength={2000} autoComplete="street-address" rows={3}/></label>
    <label>ระดับสมาชิกเริ่มต้น<select name="level" defaultValue="ลูกค้าใหม่"><option>ลูกค้าใหม่</option><option>Bronze</option><option>Silver</option><option>Gold</option><option>VIP Platinum</option></select></label>
    <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" name="keepLevel" style={{width:'auto'}}/>คงระดับสมาชิกถาวรสำหรับลูกค้าพิเศษ</label>
    <p className="muted small">เมื่อคงระดับถาวร ระบบจะใช้ระดับที่เลือกจนกว่าร้านจะเปลี่ยนหรือปลดล็อก หากไม่เลือก รอบเดือนถัดไปจะประเมินตามเกณฑ์สมาชิก</p>
    <label>รหัสผ่านเริ่มต้น<input type="password" name="password" required minLength={8} maxLength={256} autoComplete="new-password"/></label>
    <label>ยืนยันรหัสผ่าน<input type="password" name="confirmation" required minLength={8} maxLength={256} autoComplete="new-password"/></label>
    <p className="muted small">อย่างน้อย 8 ตัวอักษร ลูกค้าเปลี่ยนรหัสผ่านภายหลังได้ในหน้าของตนเอง</p>
    <button type="submit">{busy?'กำลังสร้างสมาชิก…':'สร้างสมาชิกและออกรหัสลูกค้า'}</button>
   </fieldset>
  </form>
  {error&&<p role="alert">{error}</p>}
  {duplicates.map(row=><p key={row.code}><Link href={'/admin/crm/'+encodeURIComponent(canonicalCustomerCode(row.code))}>{row.code} · {row.name||'ดูข้อมูลลูกค้าเดิม'}</Link></p>)}
 </section>;
}
