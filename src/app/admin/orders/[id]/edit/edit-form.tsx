'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
export function OrderEditForm({id,initialText,version}:{id:string;initialText:string;version:string}){
 const router=useRouter(),[text,setText]=useState(initialText),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[cancel,setCancel]=useState(false);
 const request=useRef<{body:string;key:string}|null>(null),sending=useRef(false);
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 async function save(action:'EDIT'|'CANCEL'){
  if(sending.current)return;const payload={id,expectedVersion:version,action,text,reason},body=JSON.stringify(payload);
  if(request.current?.body!==body)request.current={body,key:crypto.randomUUID()};
  sending.current=true;setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/orders/change',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestKey:request.current.key}),signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok){request.current=null;throw Error(result.error);}
   router.push('/admin/orders/list/'+result.id);router.refresh();
  }catch(failure){setError(failure instanceof Error?failure.message:'ยังยืนยันผลไม่ได้ กรุณาลองอีกครั้ง');setBusy(false);sending.current=false;}
 }
 return <section className="card">
  <label>ข้อมูลออเดอร์<textarea aria-label="ข้อมูลออเดอร์" rows={16} value={text} onChange={event=>setText(event.target.value)} disabled={busy||!ready} maxLength={12000}/></label>
  <p className="muted">แก้ชื่อผู้รับ เบอร์ ที่อยู่ รายการสินค้า และยอดรวมได้ กรุณาคงรหัสผู้ขาย รหัสลูกค้า และวิธีชำระเงินเดิม</p>
  <label>เหตุผลหรือหมายเหตุ<input value={reason} onChange={event=>setReason(event.target.value)} disabled={busy} maxLength={500}/></label>
  {error&&<p role="alert" className="notice">{error}</p>}
  <div className="actions"><button type="button" disabled={busy} onClick={()=>save('EDIT')}>{busy?'กำลังบันทึก…':'บันทึกการแก้ไข'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>setCancel(!cancel)}>ยกเลิกออเดอร์</button><Link className="button secondary" href={'/admin/orders/list/'+id}>กลับรายละเอียด</Link></div>
  {cancel&&<div className="notice"><p>ยืนยันยกเลิกออเดอร์นี้ ระบบจะคืนยอดจองและยกเลิกยอดที่ยังไม่จ่าย</p><button type="button" disabled={busy} onClick={()=>save('CANCEL')}>ยืนยันยกเลิกออเดอร์</button></div>}
 </section>;
}
