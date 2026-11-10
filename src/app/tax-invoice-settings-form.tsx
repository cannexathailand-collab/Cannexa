'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
type Settings={enabled:boolean;registeredOn:string|null;branchCode:string;vatRateBps:number;priceMode?:string;version:string};
export function TaxInvoiceSettingsForm({initial,endpoint='/api/admin/tax-invoice-settings'}:{initial:Settings|null;endpoint?:string}){
 const router=useRouter(),[enabled,setEnabled]=useState(initial?.enabled??false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <form className="form-grid" onSubmit={async event=>{
  event.preventDefault();setBusy(true);setMessage('');const form=new FormData(event.currentTarget);
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled,registeredOn:form.get('registeredOn')??'',branchCode:form.get('branchCode')??'00000',vatRateBps:Math.round(Number(form.get('rate')??7)*100),priceMode:form.get('priceMode')??'INCLUSIVE',expectedVersion:initial?.version??null})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   setMessage('บันทึกการตั้งค่า VAT แล้ว');router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false);}
 }}>
  <label style={{gridColumn:'1 / -1'}}><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/> ยืนยันว่าร้านจดทะเบียน VAT และเปิดใช้ออกใบกำกับภาษี</label>
  {!enabled&&<><input type="hidden" name="registeredOn" value={initial?.registeredOn??''}/><input type="hidden" name="branchCode" value={initial?.branchCode??'00000'}/><input type="hidden" name="priceMode" value={initial?.priceMode??'INCLUSIVE'}/><input type="hidden" name="rate" value={(initial?.vatRateBps??700)/100}/></>}
  {enabled&&<>
   <label>วันที่มีผลจดทะเบียน VAT<input name="registeredOn" type="date" required defaultValue={initial?.registeredOn?.slice(0,10)}/></label>
   <label>รหัสสาขา<input name="branchCode" pattern="[0-9]{5}" maxLength={5} required defaultValue={initial?.branchCode??'00000'}/><small>สำนักงานใหญ่ใช้ 00000</small></label>
   <label>อัตรา VAT (%)<input name="rate" type="number" min="0" max="100" step="0.01" required defaultValue={(initial?.vatRateBps??700)/100}/></label>
   <label>วิธีคิด VAT<select name="priceMode" defaultValue={initial?.priceMode??'INCLUSIVE'}><option value="INCLUSIVE">รวมอยู่ในราคาสินค้า</option><option value="EXCLUSIVE">บวกเพิ่มจากราคาสินค้า</option></select></label>
   <p className="muted">รวมในราคา 400 บาท ยอดสุทธิ 400 บาท · บวกเพิ่มที่ 7% จาก 400 บาท ยอดสุทธิ 428 บาท การตั้งค่านี้ใช้กับใบกำกับภาษีที่ออกใหม่</p>
  </>}
  <div><button disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกการตั้งค่า VAT'}</button>{message&&<p role="status">{message}</p>}</div>
 </form>;
}
