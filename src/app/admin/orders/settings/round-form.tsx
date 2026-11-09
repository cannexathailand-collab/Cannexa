'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
export function OrderRoundForm({initial,hideBackLink=false}:{initial:{closeTime:string;version:string|null};hideBackLink?:boolean}){
 const router=useRouter();
 const [time,setTime]=useState(initial.closeTime),[version,setVersion]=useState(initial.version),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [ready,setReady]=useState(false);
 useEffect(()=>setReady(true),[]);
 return <form className="card" onSubmit={async event=>{
  event.preventDefault();if(busy)return;setBusy(true);setMessage('');
  try{
   const response=await fetch('/api/admin/orders/round-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({closeTime:time,expectedVersion:version})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   setVersion(result.version);setMessage('บันทึกเวลาปิดรอบ '+result.closeTime+' น. แล้ว');router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false);}
 }}>
  <label>เวลาปิดรอบ (เวลาไทย)<input type="time" value={time} onChange={event=>setTime(event.target.value)} required disabled={busy||!ready}/></label>
  <p className="muted">เวลานี้ใช้แบ่งรายการออเดอร์ทุกวัน รวมถึงรายการย้อนหลัง ระบบใช้วันที่สิ้นสุดรอบเป็นชื่อรอบ</p>
  {message&&<p role="status">{message}</p>}
  <div className="actions"><button disabled={busy||!ready}>{busy?'กำลังบันทึก…':'บันทึกเวลาปิดรอบ'}</button>{!hideBackLink&&<Link className="button secondary" href="/admin/orders/list">กลับรายการออเดอร์</Link>}</div>
 </form>;
}
