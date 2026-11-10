'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import type {TaxInvoiceDraft} from '@/lib/tax-invoices';
import {taxInvoiceTotals} from '@/lib/tax-invoice-values';
import {DocumentBrandHeader} from './document-brand-header';

export function TaxInvoiceEditor({draft,endpoint='/api/admin/tax-invoices',documentBase='/tax-invoices'}:{draft:TaxInvoiceDraft;endpoint?:string;documentBase?:string}){
 const router=useRouter();
 const lines=draft.lines;
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const ready=lines.every(line=>line.grossSatang!==null&&line.description.trim()&&line.quantity.trim());
 const values=lines.map(line=>({...line,grossSatang:line.grossSatang??0}));
 const totals=ready&&values.reduce((sum,line)=>sum+line.grossSatang,0)<=2147483647?taxInvoiceTotals(values,draft.vatRateBps,draft.priceMode):null;
 const money=(value:number)=> (value/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
 if(draft.existingInvoiceId)return <a className="button" href={documentBase+'/'+draft.existingInvoiceId}>เปิดใบกำกับภาษีเดิม</a>;
 if(!draft.enabled)return <p role="status">กรุณาตั้งข้อมูลผู้ออกเอกสารและเปิดใช้งาน VAT ก่อน</p>;
 if(!draft.canIssue)return <p role="status">ออเดอร์นี้ยังออกใบกำกับภาษีไม่ได้ กรุณาตรวจสถานะและยอดรวม</p>;
 return <form onSubmit={async event=>{
  event.preventDefault();setBusy(true);setMessage('');
  const form=new FormData(event.currentTarget);
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:draft.orderId,sourceVersion:draft.sourceVersion,settingsVersion:draft.settingsVersion,issuerVersion:draft.issuerVersion,lines:values,locked:true,confirmed:form.get('confirmed')==='on',buyer:{name:form.get('name'),address:form.get('address'),taxId:form.get('taxId')||'',vatRegistered:form.get('vatRegistered')==='on',branchCode:form.get('branchCode')||'00000'}})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   router.push(documentBase+'/'+result.id);
  }catch(error){setMessage(error instanceof Error?error.message:'ออกเอกสารไม่สำเร็จ');setBusy(false);}
 }}>
  <section className="tax-invoice-brand-preview" aria-label="หัวใบกำกับภาษี"><DocumentBrandHeader brand={draft.branding}/></section>
  <h2>ผู้ซื้อ</h2><div className="form-grid">
   <label>ชื่อผู้ซื้อ / บริษัท<input name="name" required maxLength={200} defaultValue={draft.buyer.name}/></label>
   <label>ที่อยู่ผู้ซื้อ<textarea name="address" required maxLength={2000} defaultValue={draft.buyer.address}/></label>
   <label>เลขประจำตัวผู้เสียภาษี<input name="taxId" inputMode="numeric" pattern="[0-9]{13}" maxLength={13}/></label>
   <label>รหัสสาขา<input name="branchCode" pattern="[0-9]{5}" maxLength={5} required defaultValue="00000"/></label>
   <label><input type="checkbox" name="vatRegistered"/> ผู้ซื้อจดทะเบียน VAT</label>
  </div>
  <h2>รายการสินค้าและบริการ</h2>
  <p>รายการ จำนวน และยอดเงินดึงจากออเดอร์และล็อกไว้ {draft.priceMode==='INCLUSIVE'?'ยอดรวม VAT แล้ว':'ยอดก่อน VAT'} {money(draft.totalSatang!)} บาท</p>
  {draft.orderItems&&<><div className="table-wrap"><table><thead><tr><th>รายการตามออเดอร์</th><th>จำนวน / หน่วย</th></tr></thead><tbody>{draft.orderItems.map((item,index)=><tr key={index}><td>{item.description}</td><td>{item.quantity}</td></tr>)}</tbody></table></div><p className="muted">ออเดอร์นี้ไม่มีราคาแยกรายการที่บันทึกครบ จึงแสดงยอดรวมตามออเดอร์</p></>}
  <div className="table-wrap"><table><thead><tr><th>รายการ</th><th>จำนวน / หน่วย</th><th>{draft.priceMode==='INCLUSIVE'?'ยอดรวม VAT (บาท)':'ยอดก่อน VAT (บาท)'}</th><th>ภาษี</th></tr></thead><tbody>{values.map((line,index)=><tr key={index}>
   <td>{line.description}</td><td>{line.quantity}</td><td>{money(line.grossSatang)}</td><td>{line.treatment==='STANDARD'?'VAT '+draft.vatRateBps/100+'%':line.treatment==='ZERO'?'VAT 0%':'ยกเว้น VAT'}</td>
  </tr>)}</tbody></table></div>
  {totals&&<p>ก่อน VAT {money(totals.netSatang)} · VAT {money(totals.vatSatang)} · รวม {money(totals.totalSatang)} บาท</p>}
  <label><input type="checkbox" name="confirmed" required/> ยืนยันข้อมูลผู้ซื้อ รายการ ประเภทภาษี และออกเอกสารลงวันที่วันนี้ ข้อมูลเอกสารที่ออกแล้วจะถูกเก็บเป็นสำเนาถาวร</label>
  <p className="muted">ใบกำกับภาษีนี้สำหรับพิมพ์หรือบันทึก PDF การออกเอกสารอาจทำให้เกิดหน้าที่เสีย VAT ตามจุดความรับผิด</p>
  <button disabled={busy||!totals||values.reduce((sum,line)=>sum+line.grossSatang,0)!==draft.totalSatang}>{busy?'กำลังออกเอกสาร…':'ออกใบกำกับภาษี'}</button>
  {message&&<p role="alert">{message}</p>}
 </form>;
}
