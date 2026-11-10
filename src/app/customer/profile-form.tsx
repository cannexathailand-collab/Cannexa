'use client';
import {useCustomerLanguage} from '@/app/customer/language';
import {customerDiscoverySources} from '@/lib/customer-discovery-source';
import {validContactPhones} from '@/lib/contact-phones';

import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {CustomerCodeForm} from './code-form';
export function ProfileForm({initial,registered,completeProfile=false,savedAddresses=[]}:{initial:{username?:string;title:string;name:string;phone:string;address:string;discoverySource?:string};registered:boolean;completeProfile?:boolean;savedAddresses?:{id:string;name:string;phone:string;address:string}[]}){
 const {t}=useCustomerLanguage();
 const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const [ready,setReady]=useState(false);
 const formRef=useRef<HTMLFormElement>(null);
 const [selectedAddressId,setSelectedAddressId]=useState<string|null>(null);
 const [choosingId,setChoosingId]=useState<string|null>(null);
 const [selectionError,setSelectionError]=useState('');
 const [deliveryPhones,setDeliveryPhones]=useState(['']);
 useEffect(()=>{
  setSelectedAddressId(savedAddresses.find(address=>address.name===initial.name&&address.address===initial.address)?.id??null);
 },[initial.name,initial.address,savedAddresses]);
 async function selectAddress(address:{id:string;name:string;phone:string;address:string}){
  if(busy||address.id===selectedAddressId)return;
  setBusy(true);setChoosingId(address.id);setSelectionError('');
  try{
   const response=await fetch('/api/customer/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:initial.title||'คุณ',name:address.name,phone:address.phone,address:address.address}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'บันทึกไม่สำเร็จ');
   setSelectedAddressId(address.id);router.refresh();
  }catch(error){setSelectionError(error instanceof Error?error.message:'บันทึกไม่สำเร็จ กรุณาลองใหม่');router.refresh();}
  finally{setBusy(false);setChoosingId(null);}
 }
 useEffect(()=>setReady(true),[]);
 const [accountHistory,setAccountHistory]=useState(completeProfile?'new':'');

 if(!registered&&accountHistory!=='new')return <div className="portal-profile"><label htmlFor="account-history">{t("คุณเคยมีบัญชีกับเราแล้วหรือยัง")}</label><select id="account-history" disabled={!ready} value={accountHistory} onChange={event=>setAccountHistory(event.target.value)}><option value="">{t("กรุณาเลือก")}</option><option value="existing">{t("เคยมีแล้ว")}</option><option value="new">{t("ยังไม่เคยมี")}</option></select>{accountHistory==='existing'&&<><p>{t("กรอกรหัสลูกค้าเดิม หากเปลี่ยนบัญชี LINE ให้ติดต่อร้านเพื่อยืนยันการเชื่อมบัญชีเดิม")}</p><CustomerCodeForm/></>}</div>;
 return <div className={registered?"portal-address-layout":undefined}>{registered&&<section className="portal-saved-addresses"><div className="portal-address-heading"><h3>{t("ที่อยู่จัดส่งที่บันทึกไว้")}</h3></div>{savedAddresses.length>0?<div className="portal-address-list">{savedAddresses.map(address=><article key={address.id} className={selectedAddressId===address.id?"is-selected":""}><div><strong>{address.name}</strong><p>{address.address}</p><ul className="portal-address-phones">{(validContactPhones(address.phone)??[address.phone]).map((phone,index)=><li key={phone}><span>{t(index?"เบอร์สำรอง":"เบอร์โทร")}{index?` ${index}`:""}</span> {phone}</li>)}</ul></div><button type="button" aria-pressed={selectedAddressId===address.id} aria-busy={choosingId===address.id} disabled={!ready||busy} onClick={()=>selectAddress(address)}>{t("ใช้ที่อยู่นี้")}</button></article>)}</div>:<p className="portal-muted">{t("ยังไม่มีที่อยู่จัดส่งที่บันทึกไว้")}</p>}{selectionError&&<p className="portal-alert" role="alert">{t(selectionError)}</p>}</section>}<form ref={formRef} className={registered?"portal-profile portal-address-form":"portal-profile"} onChange={()=>setSaved(false)} method="post" action="/api/customer/profile" onSubmit={async event=>{event.preventDefault();if(busy)return;const form=new FormData(event.currentTarget);const payload=Object.fromEntries(form);if(registered){payload.phone=deliveryPhones.map(phone=>phone.trim()).filter(Boolean).join(' / ');delete payload.backupPhone;}setBusy(true);setError('');setSaved(false);try{const response=await fetch('/api/customer/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error||'บันทึกไม่สำเร็จ');if(!registered){window.location.assign('/customer');return;}setDeliveryPhones(['']);for(const field of ['name','address']){const input=formRef.current?.elements.namedItem(field) as HTMLInputElement|HTMLTextAreaElement|null;if(input)input.value='';}setSaved(true);router.refresh();}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ กรุณาลองใหม่');}finally{setBusy(false);}}}>
  {registered&&<><div className="portal-address-form-heading"><h3>{t("เพิ่มที่อยู่จัดส่ง")}</h3></div><input type="hidden" name="title" value={initial.title||'คุณ'}/></>}
  {completeProfile&&<label>{t("เบอร์โทร")}<input name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} defaultValue={initial.phone} placeholder="0812345678" required/></label>}
  {!completeProfile&&<fieldset className="portal-profile-fields" disabled={!ready||busy}>
  {!registered&&!completeProfile&&<><label htmlFor="account-history">{t("คุณเคยมีบัญชีกับเราแล้วหรือยัง")}</label><select id="account-history" disabled={!ready} value={accountHistory} onChange={event=>setAccountHistory(event.target.value)}><option value="existing">{t("เคยมีแล้ว")}</option><option value="new">{t("ยังไม่เคยมี")}</option></select></>}
  {!registered&&<><label>{t("รหัสลูกค้า / ชื่อผู้ใช้")}<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} defaultValue={initial.username??''} minLength={3} maxLength={32} required/><small>{t("ตัวอักษร ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3–32 ตัว")}</small></label><label>{t("คำนำหน้า")}<input name="title" autoComplete="honorific-prefix" defaultValue={initial.title} placeholder={t("เช่น นาย นาง นางสาว")} maxLength={40} required/></label></>}
  <label>{t("ชื่อผู้รับ")}<input name="name" autoComplete={registered?"off":"name"} defaultValue={registered?'':initial.name} maxLength={200} required/></label>
  {registered?<div className="portal-delivery-phones">{deliveryPhones.map((phone,index)=><div className="portal-phone-row" key={index}><label>{t(index?'เบอร์สำรอง':'เบอร์โทรรับพัสดุ')}{index?` ${index}`:''}<input name={index?'backupPhone':'phone'} type="tel" autoComplete="off" inputMode="tel" maxLength={20} value={phone} required={index===0} onChange={event=>{setDeliveryPhones(values=>values.map((value,position)=>position===index?event.target.value:value));setSaved(false);}}/></label>{index>0&&<button type="button" className="portal-remove-phone" aria-label={t('ลบเบอร์สำรอง')+' '+index} onClick={()=>{setDeliveryPhones(values=>values.filter((_,position)=>position!==index));setSaved(false);}}>{t("ลบ")}</button>}</div>)}<div className="portal-phone-actions"><button type="button" onClick={()=>{setDeliveryPhones(values=>[...values,'']);setSaved(false);}}>{t("เพิ่มเบอร์สำรอง")}</button></div></div>:<label>{t("เบอร์โทร")}<input name="phone" type="tel" autoComplete="tel" defaultValue={initial.phone} placeholder="0812345678 / 0898765432" required/><small>{t("เพิ่มได้หลายเบอร์ คั่นด้วย / แต่ละเบอร์ 10 หลัก")}</small></label>}
  {registered?<label>{t("ที่อยู่จัดส่ง")}<textarea name="address" autoComplete="off" defaultValue="" rows={3} maxLength={2000} required/></label>:<fieldset className="portal-address"><legend>{t("ที่อยู่จัดส่ง")}</legend>
   <label>{t("บ้านเลขที่")}<input name="houseNumber" maxLength={100} required/></label>
   <label>{t("ถนน")}<input name="road" maxLength={200}/></label>
   <label>{t("ตำบล / แขวง")}<input name="subdistrict" maxLength={100} required/></label>
   <label>{t("อำเภอ / เขต")}<input name="district" autoComplete="address-level2" maxLength={100} required/></label>
   <label>{t("จังหวัด")}<input name="province" autoComplete="address-level1" maxLength={100} required/></label>
   <label>{t("รหัสไปรษณีย์")}<input name="postalCode" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{5}" minLength={5} maxLength={5} required/></label>
  </fieldset>}
  </fieldset>}
  {!registered&&<label>{t("คุณรู้จักเราจากช่องทางไหน")}<select name="discoverySource" defaultValue={initial.discoverySource??''} disabled={!ready||busy}><option value="">{t("เลือกช่องทาง (ไม่บังคับ)")}</option>{Object.entries(customerDiscoverySources).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>}
  {!registered&&<label>{t("รหัสผู้แนะนำ (ถ้ามี)")}<input name="referrerCode" maxLength={100} autoComplete="off"/></label>}
  {error&&<p className="portal-alert" role="alert">{t(error)}</p>}{saved&&<p role="status" className="portal-success">{t("บันทึกข้อมูลเรียบร้อยแล้ว")}</p>}
  <div className="portal-profile-actions portal-profile-actions-single">
   <button disabled={!ready||busy}>{t(busy?'กำลังบันทึก…':registered?'บันทึกที่อยู่จัดส่ง':completeProfile?'เริ่มใช้งาน':'ลงทะเบียนลูกค้า')}</button>
  </div>
 </form></div>;
}
