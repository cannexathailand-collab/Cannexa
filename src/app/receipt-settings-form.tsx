'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
type Details={name:string;address:string;phone:string;taxId:string;enabled:boolean;version:string};
export function ReceiptSettingsForm({initial,endpoint='/api/admin/receipt-settings'}:{initial:Details|null;endpoint?:string}){
 const router=useRouter(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <form className="form-grid" onSubmit={async event=>{
  event.preventDefault();setBusy(true);setMessage('');
  const form=new FormData(event.currentTarget);
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.get('name'),address:form.get('address'),phone:form.get('phone'),taxId:form.get('taxId'),enabled:form.get('enabled')==='on',expectedVersion:initial?.version??null})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'บันทึกไม่สำเร็จ');
   setMessage('บันทึกข้อมูลผู้ออกใบเสร็จแล้ว');router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false);}
 }}>
  <label>ชื่อผู้ขาย / ร้านค้า<input name="name" required maxLength={200} defaultValue={initial?.name}/></label>
  <label>โทรศัพท์<input name="phone" maxLength={100} defaultValue={initial?.phone}/></label>
  <label style={{gridColumn:'1 / -1'}}>ที่อยู่ผู้ออกใบเสร็จ<textarea name="address" required maxLength={2000} rows={3} defaultValue={initial?.address}/></label>
  <label>เลขประจำตัวผู้เสียภาษี (ถ้ามี)<input name="taxId" inputMode="numeric" pattern="[0-9]{13}" maxLength={13} defaultValue={initial?.taxId}/></label>
  <label><input type="checkbox" name="enabled" defaultChecked={initial?.enabled??true}/> เปิดใช้ออกใบเสร็จจากออเดอร์ที่รับเงินแล้ว</label>
  <div style={{gridColumn:'1 / -1'}}><button disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกข้อมูลผู้ออกใบเสร็จ'}</button>{message&&<p role="status">{message}</p>}</div>
 </form>;
}
