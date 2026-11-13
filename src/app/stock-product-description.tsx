'use client';
import {useRef,useState} from 'react';
export function StockProductDescription({code,name,text,linkUrl,version,editable}:{code:string;name:string;text:string;linkUrl:string;version:string;editable:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [saved,setSaved]=useState({text,linkUrl,version}),[draft,setDraft]=useState(text),[draftLink,setDraftLink]=useState(linkUrl),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div style={{minWidth:180,maxWidth:360}}>
  {saved.text&&<p className="small" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{saved.text}</p>}
  {saved.linkUrl&&<p className="small"><a href={saved.linkUrl} target="_blank" rel="noreferrer">เปิดลิงก์</a></p>}
  {editable&&<button className="secondary small" type="button" onClick={()=>{setDraft(saved.text);setDraftLink(saved.linkUrl);setError('');dialog.current?.showModal();}}>{saved.text||saved.linkUrl?'แก้ไขคำอธิบาย / ลิงก์':'เพิ่มคำอธิบาย / ลิงก์'}</button>}
  <dialog ref={dialog} className="stock-modal" aria-label={'คำอธิบายสินค้า '+code} onCancel={event=>{if(busy)event.preventDefault();}}>
   <h2>คำอธิบายเพิ่มเติม · {code}</h2><p>{name}</p>
   <label>คำอธิบายเพิ่มเติม<textarea rows={3} maxLength={60} value={draft} disabled={busy} onChange={event=>setDraft(event.target.value)}/></label>
   <p className="small">{draft.length}/60 ตัวอักษร · ใช้เป็นคำอธิบายการ์ด LINE OA</p>
   <label>ลิงก์<input type="url" placeholder="https://" maxLength={2048} value={draftLink} disabled={busy} onChange={event=>setDraftLink(event.target.value)}/></label>
   {error&&<p role="alert">{error}</p>}
   <div className="actions"><button type="button" disabled={busy} onClick={async()=>{
    setBusy(true);setError('');try{
     const response=await fetch('/api/admin/stock/description',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,name,text:draft,linkUrl:draftLink.trim(),version:saved.version})});
     const result=await response.json();if(!response.ok)throw Error(result.error??'ยังบันทึกไม่ได้');
     setSaved({text:result.text,linkUrl:result.linkUrl,version:result.version});dialog.current?.close();
    }catch(failure){setError(failure instanceof Error?failure.message:'ยังบันทึกไม่ได้');}finally{setBusy(false);}
   }}>{busy?'กำลังบันทึก…':'บันทึกคำอธิบาย'}</button><button className="secondary" type="button" disabled={busy} onClick={()=>dialog.current?.close()}>ยกเลิก</button></div>
  </dialog>
 </div>;
}
