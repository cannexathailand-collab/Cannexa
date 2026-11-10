'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {TaxInvoiceDraft} from '@/lib/tax-invoices';
import {inclusiveTaxTotals} from '@/lib/tax-invoice-values';

export function TaxInvoiceEditor({draft,endpoint='/api/admin/tax-invoices',documentBase='/tax-invoices'}:{draft:TaxInvoiceDraft;endpoint?:string;documentBase?:string}){
 const router=useRouter();
 const [lines,setLines]=useState(draft.lines.map(line=>({...line,amount:line.grossSatang===null?'':(line.grossSatang/100).toFixed(2)})));
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const ready=lines.every(line=>/^\d+(\.\d{1,2})?$/.test(line.amount)&&Number(line.amount)<=21474836.47&&line.description.trim()&&line.quantity.trim());
 const values=lines.map(({amount,...line})=>({...line,grossSatang:Math.round(Number(amount)*100)}));
 const totals=ready&&values.reduce((sum,line)=>sum+line.grossSatang,0)<=2147483647?inclusiveTaxTotals(values,draft.vatRateBps):null;
 const money=(value:number)=> (value/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
 if(draft.existingInvoiceId)return <a className="button" href={documentBase+'/'+draft.existingInvoiceId}>เปิดใบกำกับภาษีเดิม</a>;
 if(!draft.enabled)return <p role="status">กรุณาตั้งข้อมูลผู้ออกเอกสารและเปิดใช้งาน VAT ก่อน</p>;
 if(!draft.canIssue)return <p role="status">ออเดอร์นี้ยังออกใบกำกับภาษีไม่ได้ กรุณาตรวจสถานะและยอดรวม</p>;
 return <form onSubmit={async event=>{
  event.preventDefault();setBusy(true);setMessage('');
  const form=new FormData(event.currentTarget);
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:draft.orderId,sourceVersion:draft.sourceVersion,settingsVersion:draft.settingsVersion,issuerVersion:draft.issuerVersion,lines:values,confirmed:form.get('confirmed')==='on',buyer:{name:form.get('name'),address:form.get('address'),taxId:form.get('taxId')||'',vatRegistered:form.get('vatRegistered')==='on',branchCode:form.get('branchCode')||'00000'}})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   router.push(documentBase+'/'+result.id);
  }catch(error){setMessage(error instanceof Error?error.message:'ออกเอกสารไม่สำเร็จ');setBusy(false);}
 }}>
  <h2>ผู้ซื้อ</h2><div className="form-grid">
   <label>ชื่อผู้ซื้อ / บริษัท<input name="name" required maxLength={200} defaultValue={draft.buyer.name}/></label>
   <label>ที่อยู่ผู้ซื้อ<textarea name="address" required maxLength={2000} defaultValue={draft.buyer.address}/></label>
   <label>เลขประจำตัวผู้เสียภาษี<input name="taxId" inputMode="numeric" pattern="[0-9]{13}" maxLength={13}/></label>
   <label>รหัสสาขา<input name="branchCode" pattern="[0-9]{5}" maxLength={5} required defaultValue="00000"/></label>
   <label><input type="checkbox" name="vatRegistered"/> ผู้ซื้อจดทะเบียน VAT</label>
  </div>
  <h2>รายการสินค้าและบริการ</h2>
  <p>ยอดออเดอร์รวม VAT แล้ว {money(draft.totalSatang!)} บาท · กรุณาตรวจราคาของแต่ละรายการและประเภทภาษี</p>
  <div className="table-wrap"><table><thead><tr><th>รายการ</th><th>จำนวน / หน่วย</th><th>ยอดรวม VAT (บาท)</th><th>ภาษี</th></tr></thead><tbody>{lines.map((line,index)=><tr key={index}>
   <td><input aria-label={'รายการ '+(index+1)} required maxLength={300} value={line.description} onChange={e=>setLines(lines.map((row,i)=>i===index?{...row,description:e.target.value}:row))}/></td>
   <td><input aria-label={'จำนวน '+(index+1)} required maxLength={40} value={line.quantity} onChange={e=>setLines(lines.map((row,i)=>i===index?{...row,quantity:e.target.value}:row))}/></td>
   <td><input aria-label={'ยอดรวม '+(index+1)} type="number" min="0" max="21474836.47" step="0.01" required value={line.amount} onChange={e=>setLines(lines.map((row,i)=>i===index?{...row,amount:e.target.value}:row))}/></td>
   <td><select aria-label={'ภาษี '+(index+1)} value={line.treatment} onChange={e=>setLines(lines.map((row,i)=>i===index?{...row,treatment:e.target.value as typeof line.treatment}:row))}><option value="STANDARD">VAT {draft.vatRateBps/100}%</option><option value="ZERO">VAT 0%</option><option value="EXEMPT">ยกเว้น VAT</option></select></td>
  </tr>)}</tbody></table></div>
  {totals&&<p>ก่อน VAT {money(totals.netSatang)} · VAT {money(totals.vatSatang)} · รวม {money(totals.totalSatang)} บาท</p>}
  <label><input type="checkbox" name="confirmed" required/> ยืนยันข้อมูลผู้ซื้อ รายการ ประเภทภาษี และออกเอกสารลงวันที่วันนี้ ข้อมูลเอกสารที่ออกแล้วจะถูกเก็บเป็นสำเนาถาวร</label>
  <p className="muted">ใบกำกับภาษีนี้สำหรับพิมพ์หรือบันทึก PDF การออกเอกสารอาจทำให้เกิดหน้าที่เสีย VAT ตามจุดความรับผิด</p>
  <button disabled={busy||!totals||totals.totalSatang!==draft.totalSatang}>{busy?'กำลังออกเอกสาร…':'ออกใบกำกับภาษี'}</button>
  {message&&<p role="alert">{message}</p>}
 </form>;
}
