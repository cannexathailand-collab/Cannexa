'use client';
import {useCustomerLanguage} from '@/app/customer/language';
import {customerDiscoverySources} from '@/lib/customer-discovery-source';

import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CustomerCodeForm} from './code-form';
export function ProfileForm({initial,registered,completeProfile=false,savedAddresses=[],registrationPhone=''}:{initial:{username?:string;title:string;name:string;phone:string;address:string;discoverySource?:string};registered:boolean;completeProfile?:boolean;savedAddresses?:{id:string;name:string;phone:string;address:string}[];registrationPhone?:string}){
 const {t}=useCustomerLanguage();
 const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const [ready,setReady]=useState(false);
 const formRef=useRef<HTMLFormElement>(null);
 const [addingAddress,setAddingAddress]=useState(registered);
 function fillAddress(address:{name:string;phone:string;address:string},adding:boolean){
  const form=formRef.current;
  if(!form)return;
  for(const field of ['name','phone','address'] as const){
   const input=form.elements.namedItem(field) as HTMLInputElement|HTMLTextAreaElement|null;
   if(input)input.value=address[field];
  }
  setAddingAddress(adding);setSaved(false);setError('');
  form.scrollIntoView({block:'start',behavior:'smooth'});
  (form.elements.namedItem('name') as HTMLInputElement|null)?.focus({preventScroll:true});
 }
 useEffect(()=>setReady(true),[]);
 const [accountHistory,setAccountHistory]=useState(completeProfile?'new':'');

 if(!registered&&accountHistory!=='new')return <div className="portal-profile"><label htmlFor="account-history">{t("คุณเคยมีบัญชีกับเราแล้วหรือยัง")}</label><select id="account-history" disabled={!ready} value={accountHistory} onChange={event=>setAccountHistory(event.target.value)}><option value="">{t("กรุณาเลือก")}</option><option value="existing">{t("เคยมีแล้ว")}</option><option value="new">{t("ยังไม่เคยมี")}</option></select>{accountHistory==='existing'&&<><p>{t("กรอกรหัสลูกค้าเดิม หากเปลี่ยนบัญชี LINE ให้ติดต่อร้านเพื่อยืนยันการเชื่อมบัญชีเดิม")}</p><CustomerCodeForm/></>}</div>;
 return <div className={registered?"portal-address-layout":undefined}>{registered&&<section className="portal-saved-addresses"><div className="portal-address-heading"><h3>{t("ที่อยู่จัดส่งที่บันทึกไว้")}</h3></div>{savedAddresses.length>0?<div className="portal-address-list">{savedAddresses.map(address=><article key={address.id}><div><strong>{address.name}</strong><p>{address.address}</p><p>{address.phone}</p></div><button type="button" disabled={!ready||busy} onClick={()=>fillAddress(address,false)}>{t("ใช้ที่อยู่นี้")}</button></article>)}</div>:<p className="portal-muted">{t("ยังไม่มีที่อยู่จัดส่งที่บันทึกไว้")}</p>}</section>}<form ref={formRef} className={registered?"portal-profile portal-address-form":"portal-profile"} onChange={()=>setSaved(false)} method="post" action="/api/customer/profile" onSubmit={async event=>{event.preventDefault();if(busy)return;const form=new FormData(event.currentTarget);setBusy(true);setError('');setSaved(false);try{const response=await fetch('/api/customer/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form)),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error||'บันทึกไม่สำเร็จ');if(!registered){window.location.assign('/customer');return;}setSaved(true);setAddingAddress(false);router.refresh();}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ กรุณาลองใหม่');}finally{setBusy(false);}}}>
  {registered&&<div className="portal-address-form-heading"><h3>{t(addingAddress?"เพิ่มที่อยู่จัดส่ง":"ข้อมูลที่อยู่จัดส่ง")}</h3>{!addingAddress&&<button type="button" disabled={!ready||busy} onClick={()=>fillAddress({name:'',address:'',phone:''},true)}>{t("เพิ่มที่อยู่ใหม่")}</button>}</div>}
  {completeProfile&&<label>{t("เบอร์โทร")}<input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} defaultValue={initial.phone} placeholder="0812345678" required/></label>}
  {!completeProfile&&<fieldset className="portal-profile-fields" disabled={!ready||busy}>
  {!registered&&!completeProfile&&<><label htmlFor="account-history">{t("คุณเคยมีบัญชีกับเราแล้วหรือยัง")}</label><select id="account-history" disabled={!ready} value={accountHistory} onChange={event=>setAccountHistory(event.target.value)}><option value="existing">{t("เคยมีแล้ว")}</option><option value="new">{t("ยังไม่เคยมี")}</option></select></>}
  {!registered&&<><label>{t("รหัสลูกค้า / ชื่อผู้ใช้")}<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} defaultValue={initial.username??''} minLength={3} maxLength={32} required/><small>{t("ตัวอักษร ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3–32 ตัว")}</small></label><label>{t("คำนำหน้า")}<input name="title" autoComplete="honorific-prefix" defaultValue={initial.title} placeholder={t("เช่น นาย นาง นางสาว")} maxLength={40} required/></label></>}
  <label>{t("ชื่อผู้รับ")}<input name="name" autoComplete="name" defaultValue={registered?'':initial.name} maxLength={200} required/></label>
  <label>{t("เบอร์โทร")}<input name="phone" type="tel" autoComplete="tel" defaultValue={registered?'':initial.phone} placeholder="0812345678 / 0898765432" required/><small>{t("เพิ่มได้หลายเบอร์ คั่นด้วย / แต่ละเบอร์ 10 หลัก")}</small>{registered&&registrationPhone&&<button className="portal-use-registration-phone" type="button" onClick={()=>{const input=formRef.current?.elements.namedItem('phone') as HTMLInputElement|null;if(input)input.value=registrationPhone;setSaved(false);}}>{t("ใช้เบอร์เดียวกับที่สมัคร")}</button>}</label>
  {registered?<label>{t("ที่อยู่จัดส่ง")}<textarea name="address" autoComplete="street-address" defaultValue="" rows={3} maxLength={2000} placeholder={t("บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด และรหัสไปรษณีย์")} required/></label>:<fieldset className="portal-address"><legend>{t("ที่อยู่จัดส่ง")}</legend>
   <label>{t("บ้านเลขที่")}<input name="houseNumber" maxLength={100} required/></label>
   <label>{t("ถนน")}<input name="road" maxLength={200}/></label>
   <label>{t("ตำบล / แขวง")}<input name="subdistrict" maxLength={100} required/></label>
   <label>{t("อำเภอ / เขต")}<input name="district" autoComplete="address-level2" maxLength={100} required/></label>
   <label>{t("จังหวัด")}<input name="province" autoComplete="address-level1" maxLength={100} required/></label>
   <label>{t("รหัสไปรษณีย์")}<input name="postalCode" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{5}" minLength={5} maxLength={5} required/></label>
  </fieldset>}
  </fieldset>}
  {registered&&<details className="portal-profile-extra"><summary>{t("ข้อมูลเพิ่มเติม")}</summary><fieldset disabled={!ready||busy}><label>{t("รหัสลูกค้า / ชื่อผู้ใช้")}<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} defaultValue={initial.username??''} minLength={3} maxLength={32}/><small>{t("ตัวอักษร ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3–32 ตัว")}</small></label><label>{t("คำนำหน้า")}<input name="title" autoComplete="honorific-prefix" defaultValue={initial.title} maxLength={40}/></label><label>{t("คุณรู้จักเราจากช่องทางไหน")}<select name="discoverySource" defaultValue={initial.discoverySource??''}><option value="">{t("เลือกช่องทาง (ไม่บังคับ)")}</option>{Object.entries(customerDiscoverySources).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label></fieldset></details>}
  {!registered&&<label>{t("คุณรู้จักเราจากช่องทางไหน")}<select name="discoverySource" defaultValue={initial.discoverySource??''} disabled={!ready||busy}><option value="">{t("เลือกช่องทาง (ไม่บังคับ)")}</option>{Object.entries(customerDiscoverySources).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>}
  {!registered&&<label>{t("รหัสผู้แนะนำ (ถ้ามี)")}<input name="referrerCode" maxLength={100} autoComplete="off"/></label>}
  {error&&<p className="portal-alert" role="alert">{t(error)}</p>}{saved&&<p role="status" className="portal-success">{t("บันทึกข้อมูลเรียบร้อยแล้ว")}</p>}
  <div className="portal-profile-actions portal-profile-actions-single">
   <button disabled={!ready||busy}>{t(busy?'กำลังบันทึก…':registered?addingAddress?'บันทึกที่อยู่จัดส่ง':'บันทึกข้อมูล':completeProfile?'เริ่มใช้งาน':'ลงทะเบียนลูกค้า')}</button>
  </div>
 </form></div>;
}
