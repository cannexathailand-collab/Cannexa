'use client';
import {useCustomerLanguage} from '@/app/customer/language';
import {customerDiscoverySources} from '@/lib/customer-discovery-source';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CustomerCodeForm} from './code-form';
export function ProfileForm({initial,registered,completeProfile=false}:{initial:{username?:string;title:string;name:string;phone:string;address:string;discoverySource?:string};registered:boolean;completeProfile?:boolean}){
 const {t}=useCustomerLanguage();
 const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const [ready,setReady]=useState(false);
 useEffect(()=>setReady(true),[]);
 const [accountHistory,setAccountHistory]=useState(completeProfile?'new':'');
 const [editing,setEditing]=useState(!registered);
 if(!registered&&accountHistory!=='new')return <div className="portal-profile"><label htmlFor="account-history">{t("คุณเคยมีบัญชีกับเราแล้วหรือยัง")}</label><select id="account-history" disabled={!ready} value={accountHistory} onChange={event=>setAccountHistory(event.target.value)}><option value="">{t("กรุณาเลือก")}</option><option value="existing">{t("เคยมีแล้ว")}</option><option value="new">{t("ยังไม่เคยมี")}</option></select>{accountHistory==='existing'&&<><p>{t("กรอกรหัสลูกค้าเดิม หากเปลี่ยนบัญชี LINE ให้ติดต่อร้านเพื่อยืนยันการเชื่อมบัญชีเดิม")}</p><CustomerCodeForm/></>}</div>;
 return <form className="portal-profile" method="post" action="/api/customer/profile" onSubmit={async event=>{event.preventDefault();if(busy||!editing)return;const form=new FormData(event.currentTarget);setBusy(true);setError('');setSaved(false);try{const response=await fetch('/api/customer/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form)),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error||'บันทึกไม่สำเร็จ');if(!registered){window.location.assign('/customer');return;}setSaved(true);setEditing(false);router.refresh();}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ กรุณาลองใหม่');}finally{setBusy(false);}}}>
  {completeProfile&&<label>{t("เบอร์โทร")}<input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} defaultValue={initial.phone} placeholder="0812345678" required/></label>}
  {!completeProfile&&<fieldset className="portal-profile-fields" disabled={!editing||busy}>
  {!registered&&!completeProfile&&<><label htmlFor="account-history">{t("คุณเคยมีบัญชีกับเราแล้วหรือยัง")}</label><select id="account-history" disabled={!ready} value={accountHistory} onChange={event=>setAccountHistory(event.target.value)}><option value="existing">{t("เคยมีแล้ว")}</option><option value="new">{t("ยังไม่เคยมี")}</option></select></>}
  {!completeProfile&&<label>{t("รหัสลูกค้า / ชื่อผู้ใช้")}<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} defaultValue={initial.username??''} minLength={3} maxLength={32} required={!registered}/><small>{t("ตัวอักษร ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3–32 ตัว")}</small></label>}
  <label>{t("คำนำหน้า")}<input name="title" autoComplete="honorific-prefix" defaultValue={initial.title} placeholder={t("เช่น นาย นาง นางสาว")} maxLength={40} required/></label>
  <label>{t("ชื่อผู้รับ")}<input name="name" autoComplete="name" defaultValue={initial.name} maxLength={200} required/></label>
  <label>{t("เบอร์โทร")}<input name="phone" type="tel" autoComplete="tel" defaultValue={initial.phone} placeholder="0812345678 / 0898765432" required/><small>{t("เพิ่มได้หลายเบอร์ คั่นด้วย / แต่ละเบอร์ 10 หลัก")}</small></label>
  {registered?<label>{t("ที่อยู่จัดส่ง")}<textarea name="address" autoComplete="street-address" defaultValue={initial.address} rows={4} maxLength={2000} placeholder={t("บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด และรหัสไปรษณีย์")} required/></label>:<fieldset className="portal-address"><legend>{t("ที่อยู่จัดส่ง")}</legend>
   <label>{t("บ้านเลขที่")}<input name="houseNumber" maxLength={100} required/></label>
   <label>{t("ถนน")}<input name="road" maxLength={200}/></label>
   <label>{t("ตำบล / แขวง")}<input name="subdistrict" maxLength={100} required/></label>
   <label>{t("อำเภอ / เขต")}<input name="district" autoComplete="address-level2" maxLength={100} required/></label>
   <label>{t("จังหวัด")}<input name="province" autoComplete="address-level1" maxLength={100} required/></label>
   <label>{t("รหัสไปรษณีย์")}<input name="postalCode" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{5}" minLength={5} maxLength={5} required/></label>
  </fieldset>}
  </fieldset>}
  <label>{t("คุณรู้จักเราจากช่องทางไหน")}<select name="discoverySource" defaultValue={initial.discoverySource??''} disabled={registered&&(!editing||busy)}><option value="">{t("เลือกช่องทาง (ไม่บังคับ)")}</option>{Object.entries(customerDiscoverySources).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
  {!registered&&<label>{t("รหัสผู้แนะนำ (ถ้ามี)")}<input name="referrerCode" maxLength={100} autoComplete="off"/></label>}
  {error&&<p className="portal-alert" role="alert">{t(error)}</p>}{saved&&<p role="status" className="portal-success">{t("บันทึกข้อมูลเรียบร้อยแล้ว")}</p>}
  <div className={'portal-profile-actions'+(registered?'':' portal-profile-actions-single')}>
   <button disabled={!ready||busy||!editing}>{t(busy?'กำลังบันทึก…':registered?'บันทึกข้อมูล':completeProfile?'เริ่มใช้งาน':'ลงทะเบียนลูกค้า')}</button>
   {registered&&<button className="portal-edit-button" type="button" disabled={!ready||busy||editing} onClick={()=>{setEditing(true);setSaved(false);setError('');}}>{t("แก้ไขข้อมูล")}</button>}
  </div>
 </form>;
}
