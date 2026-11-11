'use client';
import {useEffect,useRef,useState} from 'react';
import type {CustomerLineStatus} from '@/lib/customer-line-message';
import {displayCustomerCode} from '@/lib/customer-code';
import './customer-message.css';

export function CustomerMessageButton({code,name,status}:{code:string;name:string|null;status:CustomerLineStatus}){
 const dialog=useRef<HTMLDialogElement>(null);
 const request=useRef<{key:string;text:string}|null>(null);
 const [ready,setReady]=useState(false),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 useEffect(()=>setReady(true),[]);
 return <div className="customer-message-control">
  <span className="small">ชื่อ LINE: {status.displayName||'ยังไม่มีข้อมูล'}</span>
  <span className={'customer-line-status'+(status.ready?' ready':'')}>{status.label}</span>
  {status.ready&&<button type="button" className="customer-message-open" disabled={!ready} onClick={()=>{if(sent){setError('');setSent(false);setText('');request.current=null;}dialog.current?.showModal();}}>ส่งข้อความ</button>}
  <dialog ref={dialog} className="customer-message-dialog" aria-labelledby={'message-title-'+code} onCancel={event=>{if(busy)event.preventDefault();}}>
   <h2 id={'message-title-'+code}>ส่งข้อความผ่าน LINE</h2>
   <p><strong>{name||displayCustomerCode(code)}</strong> · {displayCustomerCode(code)}</p>
   {sent?<p role="status" className="customer-message-success">LINE รับคำขอส่งข้อความแล้ว</p>:<>
    <label>ข้อความ<textarea rows={5} maxLength={5000} value={text} disabled={busy||!!request.current} onChange={event=>setText(event.target.value)} placeholder="พิมพ์ข้อความถึงลูกค้า"/></label>
    <p className="muted small">{text.length.toLocaleString('th-TH')} / 5,000 ตัวอักษร</p>
   </>}
   {error&&<p role="alert" className="customer-message-error">{error}</p>}
   <div className="customer-message-actions">
    <button type="button" className="secondary" disabled={busy} onClick={()=>dialog.current?.close()}>{sent?'ปิด':'ยกเลิก'}</button>
    {!sent&&<button type="button" disabled={busy||!text.trim()} onClick={async()=>{
     if(busy||!text.trim())return;
     request.current??={key:crypto.randomUUID(),text:text.trim()};setBusy(true);setError('');
     try{
      const response=await fetch('/api/admin/customers/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,requestKey:request.current.key,text:request.current.text}),signal:AbortSignal.timeout(25000)});
      const result=await response.json();if(!response.ok)throw Error(result.error||'ส่งข้อความไม่สำเร็จ');setSent(true);
     }catch(error){setError(error instanceof Error?error.message:'ยังยืนยันการส่งไม่ได้ กรุณาลองอีกครั้ง');}
     finally{setBusy(false);}
    }}>{busy?'กำลังส่ง…':request.current?'ลองส่งอีกครั้ง':'ส่งข้อความ'}</button>}
   </div>
  </dialog>
 </div>;
}
