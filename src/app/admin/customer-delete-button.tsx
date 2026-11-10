'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {displayCustomerCode} from '@/lib/customer-code';
import './customer-delete.css';

export function CustomerDeleteButton({code,name,endpoint='/api/admin/customers/delete'}:{code:string;name?:string|null;endpoint?:string}){
 const dialog=useRef<HTMLDialogElement>(null),requestKey=useRef<string|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[deleted,setDeleted]=useState(false);
 const [ready,setReady]=useState(false);
 useEffect(()=>setReady(true),[]);
 const router=useRouter();
 if(deleted)return <span className="customer-deleted-status">ลบข้อมูลสมาชิกแล้ว</span>;
 return <><button type="button" className="customer-delete-button" disabled={!ready} onClick={()=>dialog.current?.showModal()}>ลบข้อมูลสมาชิก</button>
 <dialog ref={dialog} className="customer-delete-dialog" aria-labelledby={'delete-title-'+code} onCancel={event=>{if(busy)event.preventDefault();}}>
  <h2 id={'delete-title-'+code}>ลบข้อมูลสมาชิก</h2>
  <p><strong>{name||displayCustomerCode(code)}</strong> · {displayCustomerCode(code)}</p>
  <p>ล้างชื่อ เบอร์โทร ที่อยู่จัดส่ง และข้อมูลเข้าสู่ระบบ ลูกค้าต้องสมัครใหม่เมื่อกลับเข้าใช้งาน</p>
  <p>ออเดอร์ ใบเสร็จ และข้อมูลบัญชีจะเก็บไว้</p>
  {error&&<p role="alert" className="customer-delete-error">{error}</p>}
  <div className="customer-delete-actions"><button type="button" disabled={busy} onClick={()=>dialog.current?.close()}>ยกเลิก</button>
   <button type="button" className="customer-delete-confirm" disabled={busy} onClick={async()=>{
    if(busy)return;
    setBusy(true);setError('');requestKey.current??=crypto.randomUUID();
    try{
     const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,requestKey:requestKey.current}),signal:AbortSignal.timeout(20000)});
     const result=await response.json();if(!response.ok)throw Error(result.error||'ลบข้อมูลไม่สำเร็จ');
     dialog.current?.close();setDeleted(true);router.refresh();
    }catch(error){setError(error instanceof Error?error.message:'ลบข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง');}
    finally{setBusy(false);}
   }}>{busy?'กำลังลบ…':'ยืนยันลบข้อมูลสมาชิก'}</button>
  </div>
 </dialog></>;
}
