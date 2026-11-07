'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {CustomerCodeForm} from './code-form';
export function ProfileForm({initial,registered}:{initial:{name:string;phone:string;address:string};registered:boolean}){
 const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const [accountHistory,setAccountHistory]=useState('');
 if(!registered&&accountHistory!=='new')return <div className="portal-profile"><label htmlFor="account-history">คุณเคยมีบัญชีกับเราแล้วหรือยัง</label><select id="account-history" value={accountHistory} onChange={event=>setAccountHistory(event.target.value)}><option value="">กรุณาเลือก</option><option value="existing">เคยมีแล้ว</option><option value="new">ยังไม่เคยมี</option></select>{accountHistory==='existing'&&<><p>กรอกรหัสลูกค้าเดิม หากเปลี่ยนบัญชี LINE ให้ติดต่อร้านเพื่อยืนยันการเชื่อมบัญชีเดิม</p><CustomerCodeForm/></>}</div>;
 return <form className="portal-profile" onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');setSaved(false);const form=new FormData(event.currentTarget);try{const response=await fetch('/api/customer/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form)),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error||'บันทึกไม่สำเร็จ');if(!registered){window.location.assign(result.pending?'/customer':'/customer/password');return;}setSaved(true);router.refresh();}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ กรุณาลองใหม่');}finally{setBusy(false);}}}>
  {!registered&&<><label htmlFor="account-history">คุณเคยมีบัญชีกับเราแล้วหรือยัง</label><select id="account-history" value={accountHistory} onChange={event=>setAccountHistory(event.target.value)}><option value="existing">เคยมีแล้ว</option><option value="new">ยังไม่เคยมี</option></select></>}
  <label>ชื่อผู้รับ<input name="name" autoComplete="name" defaultValue={initial.name} maxLength={200} required/></label>
  <label>เบอร์โทร<input name="phone" type="tel" autoComplete="tel" defaultValue={initial.phone} placeholder="0812345678 / 0898765432" required/><small>ใส่ได้ 2 เบอร์ แต่ละเบอร์ 10 หลัก</small></label>
  {!registered&&<label>รหัสผู้แนะนำ (ถ้ามี)<input name="referrerCode" maxLength={100} autoComplete="off"/></label>}
  {registered?<label>ที่อยู่จัดส่ง<textarea name="address" autoComplete="street-address" defaultValue={initial.address} rows={4} maxLength={2000} placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด และรหัสไปรษณีย์" required/></label>:<fieldset className="portal-address"><legend>ที่อยู่จัดส่ง</legend>
   <label>บ้านเลขที่<input name="houseNumber" maxLength={100} required/></label>
   <label>ถนน<input name="road" maxLength={200}/></label>
   <label>ตำบล / แขวง<input name="subdistrict" maxLength={100} required/></label>
   <label>อำเภอ / เขต<input name="district" autoComplete="address-level2" maxLength={100} required/></label>
   <label>จังหวัด<input name="province" autoComplete="address-level1" maxLength={100} required/></label>
   <label>รหัสไปรษณีย์<input name="postalCode" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{5}" minLength={5} maxLength={5} required/></label>
  </fieldset>}
  {error&&<p className="portal-alert" role="alert">{error}</p>}{saved&&<p role="status" className="portal-success">บันทึกข้อมูลเรียบร้อยแล้ว</p>}
  <button disabled={busy}>{busy?'กำลังบันทึก…':registered?'บันทึกข้อมูล':'ลงทะเบียนลูกค้า'}</button>
 </form>;
}
