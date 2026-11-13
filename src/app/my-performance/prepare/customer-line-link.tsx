'use client';
import {useEmployeeLanguage} from '@/app/my-performance/language';
import {useEffect,useRef,useState} from 'react';
import './customer-line-link.css';

export function CustomerLineLink({code,active}:{code:string;active:boolean}){
 const {t,locale}=useEmployeeLanguage();

 const [linked,setLinked]=useState<boolean|null>(null),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const creating=useRef(false);
 const statusVersion=useRef(0);
 async function request(action:'status'|'create',signal?:AbortSignal){
  const timeout=AbortSignal.timeout(15000);
  const response=await fetch('/api/order-drafts/customer-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,action}),signal:signal?AbortSignal.any([signal,timeout]):timeout});
  const result=await response.json();if(!response.ok)throw Error(result.error||'ทำรายการไม่สำเร็จ');
  return result as {linked:boolean;url?:string};
 }
 async function refresh(){
  const version=++statusVersion.current;
  try{const result=await request('status');if(version===statusVersion.current){setLinked(result.linked);setError('');}}catch(error){if(version===statusVersion.current)setError(error instanceof Error?error.message:'ตรวจสถานะไม่สำเร็จ');}
 }
 useEffect(()=>{
  if(!active)return;
  const controller=new AbortController();
  async function check(){
   const version=++statusVersion.current;
   try{const result=await request('status',controller.signal);if(!controller.signal.aborted&&version===statusVersion.current){setLinked(result.linked);setError('');}}
   catch(error){if(!controller.signal.aborted&&version===statusVersion.current)setError(error instanceof Error?error.message:'ตรวจสถานะไม่สำเร็จ');}
  }
  void check();
  const timer=url&&linked!==true?setInterval(()=>{if(document.visibilityState==='visible')void check();},10000):undefined;
  return()=>{controller.abort();if(timer)clearInterval(timer);};
 },[code,active,url,linked]);
 async function copy(value:string){
  try{await navigator.clipboard.writeText(value);setNotice('คัดลอกแล้ว ส่งลิงก์นี้ให้ลูกค้ารายนี้เพื่อยืนยัน LINE');}
  catch{setNotice('เลือกคัดลอกลิงก์จากช่องด้านล่างได้เลย');}
 }
 return <section className="draft-line-link" aria-label={t("ผูก LINE ของลูกค้า")}>
  <div className="draft-line-link-heading"><strong>{t("LINE ของลูกค้า ")}{code}</strong><span role="status" className={linked?'is-linked':''}>{linked===null?t('กำลังตรวจสอบ…'):linked?t('ผูก LINE แล้ว'):url?t('รอลูกค้ายืนยัน LINE'):t('ยังไม่ผูก LINE')}</span></div>
  {linked===false&&<div className="draft-line-link-actions">
   <button type="button" disabled={busy} onClick={async()=>{
    if(creating.current)return;
    if(url){await copy(url);return;}
    creating.current=true;setBusy(true);setError('');
    try{const result=await request('create');statusVersion.current++;setLinked(result.linked);if(result.url){setUrl(result.url);await copy(result.url);}}
    catch(error){setError(error instanceof Error?error.message:'สร้างลิงก์ไม่สำเร็จ');}
    finally{creating.current=false;setBusy(false);}
   }}>{busy?t('กำลังสร้างลิงก์…'):url?t('คัดลอกลิงก์ผูก LINE'):t('สร้างลิงก์ผูก LINE')}</button>
   <button type="button" className="secondary" disabled={busy} onClick={()=>void refresh()}>{t("ตรวจสถานะอีกครั้ง")}</button>
  </div>}
  {url&&!linked&&<><label>{t("ลิงก์ส่วนตัวของลูกค้ารายนี้")}<input readOnly value={url} onFocus={event=>event.currentTarget.select()}/></label><small>{t("ไม่มีวันหมดอายุ ใช้ผูกได้ครั้งเดียว ระบบจะตรวจสถานะให้ขณะเปิดหน้านี้")}</small></>}
  {notice&&!linked&&<p role="status">{t(notice)}</p>}
  {error&&<p role="alert">{t(error)} <button type="button" className="secondary" onClick={()=>void refresh()}>{t("ลองตรวจอีกครั้ง")}</button></p>}
 </section>;
}
