'use client';
import {useRef,useState} from 'react';
import Link from 'next/link';
import type {RejectedOrderMatch} from '@/lib/rejected-shipments';

type Candidate={id:string;orderNumber:string;recipient:string|null;phone:string|null;payment:string|null;eventAt:string;amountSatang:number|null;address:string|null;addressMatches:boolean};
type Row={tracking:string;recipient:string;phone:string;address?:string;payment?:'COD'|'โอน';amountSatang?:number;candidates:Candidate[];existingOrderId:string|null;selectedOrderId:string|null;matchMessage?:string;rejectedOrders?:RejectedOrderMatch[]};
const localNow=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,16);
export function ShipmentUpload(){
 const [rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState<Record<string,string>>({});
 const [filename,setFilename]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [date,setDate]=useState(localNow),[confirmed,setConfirmed]=useState(false),[done,setDone]=useState<number|null>(null);
 const key=useRef(''),sending=useRef(false);
 const pending=useRef<string|null>(null);
 const [retrying,setRetrying]=useState(false);
 const missing=rows.filter(row=>!selected[row.tracking]).length;
 const count=rows.filter(row=>selected[row.tracking]&&selected[row.tracking]!=='SKIP').length;
 async function upload(file?:File){
  if(!file)return;
  setBusy(true);setError('');setRows([]);setDone(null);setConfirmed(false);
  try{
   const form=new FormData();form.set('file',file);
   const response=await fetch('/api/admin/shipments/upload',{method:'POST',body:form,signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   const next:Row[]=result.rows;setRows(next);setFilename(file.name);key.current=crypto.randomUUID();pending.current=null;setRetrying(false);
   setSelected(Object.fromEntries(next.map(row=>[row.tracking,row.existingOrderId?'SKIP':row.selectedOrderId??''])));
  }catch(failure){setError(failure instanceof Error?failure.message:'อ่านไฟล์ไม่สำเร็จ');}finally{setBusy(false);}
 }
 async function save(){
  if(sending.current||missing||!confirmed||!count)return;
  sending.current=true;setBusy(true);setError('');
  try{
   pending.current??=JSON.stringify({requestKey:key.current,filename,dispatchedAt:date,confirmed,rows:rows.filter(row=>selected[row.tracking]!=='SKIP').map(row=>({tracking:row.tracking,recipient:row.recipient,phone:row.phone,orderId:selected[row.tracking],payment:row.payment,amountSatang:row.amountSatang}))});
   setRetrying(true);
   const response=await fetch('/api/admin/shipments/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:pending.current,signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok){pending.current=null;setRetrying(false);throw Error(result.error);}
   setDone(result.count);
  }catch(failure){setError(failure instanceof Error?failure.message:'ยังยืนยันผลนำเข้าไม่ได้ กรุณาลองคำขอเดิมอีกครั้ง');}finally{sending.current=false;setBusy(false);}
 }
 return <section className="card">
  <label>ไฟล์เลขพัสดุ<input type="file" accept=".xlsx,.csv" disabled={busy||retrying} onChange={event=>upload(event.target.files?.[0])}/></label>
  <p className="muted">รองรับรูปแบบ Export Data ที่มีเบอร์โทร ยอดเงิน และ TRACKING NO. ขนาดไม่เกิน 2 MB จับคู่ด้วยเบอร์โทรและยอดขาย</p>
  <p className="muted">เมื่อเบอร์และยอดตรงกันหลายออเดอร์ ระบบเทียบที่อยู่จัดส่งต่อ แล้วเลือกออเดอร์เก่าสุดในกลุ่มที่อยู่ตรงกัน</p>
  {error&&<p role="alert" className="notice">{error}</p>}
  {done!==null?<p role="status" className="notice live">นำเข้าและผูกเลขพัสดุแล้ว {done} รายการ <Link href="/admin/orders/list">เปิดรายการออเดอร์</Link></p>:rows.length>0&&<>
   <h2>ตรวจรายการจาก {filename}</h2><p>พบ {rows.length} รายการ · เลือกนำเข้า {count} รายการ · รอเลือกออเดอร์ {missing} รายการ</p>
   <div className="table-wrap"><table><thead><tr><th>เลขพัสดุ</th><th>ผู้รับในไฟล์</th><th>เบอร์โทร</th><th>ออเดอร์ที่จับคู่</th></tr></thead><tbody>{rows.map(row=><tr key={row.tracking}>
    <td>{row.tracking}</td><td>{row.recipient}<div className="muted small">{row.address}</div></td><td>{row.phone}<div>{row.payment} {row.amountSatang!==undefined?(row.amountSatang/100).toLocaleString('th-TH')+' บาท':''}</div></td><td>
     <select aria-label={'ออเดอร์สำหรับ '+row.tracking} value={selected[row.tracking]??''} disabled={busy||retrying} onChange={event=>setSelected({...selected,[row.tracking]:event.target.value})}>
      <option value="">{row.candidates.length?'เลือกออเดอร์':row.matchMessage||'ไม่พบออเดอร์ที่เบอร์โทรและยอดขายตรงกัน'}</option>
      <option value="SKIP">ข้ามรายการนี้</option>
      {row.candidates.map(order=><option key={order.id} value={order.id}>{order.orderNumber} · {order.recipient} · {order.amountSatang===null?'':(order.amountSatang/100).toLocaleString('th-TH')+' บาท'} · {new Date(order.eventAt).toLocaleDateString('th-TH')}</option>)}
     </select>
     {selected[row.tracking]&&selected[row.tracking]!=='SKIP'&&<p className="muted small">{row.candidates.find(order=>order.id===selected[row.tracking])?.address}</p>}
     {row.matchMessage&&<p className="muted">{row.matchMessage}</p>}
     {!!row.rejectedOrders?.length&&<div className="notice">
      <strong>พบประวัติปฏิเสธที่เบอร์และยอดตรงกัน</strong>
      {row.rejectedOrders.map(rejected=><p key={rejected.id}>{new Date(rejected.at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})} · {rejected.reasons.join(' · ')}</p>)}
      <p>เก็บเบอร์โทรและเลขพัสดุนี้ในประวัติแล้ว กรุณาตรวจสอบการจัดส่งกับแอดมิน</p>
     </div>}
    </td>
   </tr>)}</tbody></table></div>
   <label>วันเวลาที่ส่งพัสดุจริง<input type="datetime-local" value={date} disabled={busy||retrying} onChange={event=>setDate(event.target.value)}/></label>
   <label><input type="checkbox" checked={confirmed} disabled={busy||retrying} onChange={event=>setConfirmed(event.target.checked)}/> ตรวจออเดอร์แล้ว และยืนยันว่าได้ส่งพัสดุรายการนี้แล้ว</label>
   <p className="muted">รายงานขนส่งภายหลังจะเติมค่าส่งและยอดรับเงิน COD ตามเลขพัสดุ</p>
   <button type="button" disabled={busy||missing>0||!confirmed||!count} onClick={save}>{busy?'กำลังนำเข้า…':retrying?'ลองนำเข้าคำขอเดิมอีกครั้ง':'ยืนยันส่งและนำเข้า'}</button>
  </>}
 </section>;
}
