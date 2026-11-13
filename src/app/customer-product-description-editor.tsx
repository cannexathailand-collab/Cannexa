'use client';
import {useRef,useState} from 'react';
export function CustomerProductDescriptionEditor({code,name,description,version,editable}:{code:string;name:string;description:string;version:string;editable:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [saved,setSaved]=useState({description,version}),[draft,setDraft]=useState(description),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div>
  {saved.description&&<p className="small" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxWidth:360}}>{saved.description}</p>}
  {editable&&<button type="button" className="secondary small" onClick={()=>{setDraft(saved.description);setError('');dialog.current?.showModal();}}>{saved.description?'แก้ไขคำอธิบายสินค้า':'เพิ่มคำอธิบายสินค้า'}</button>}
  <dialog ref={dialog} className="stock-modal" aria-label={'คำอธิบายสินค้า '+code} onCancel={event=>{if(busy)event.preventDefault();}}>
   <h2>คำอธิบายสินค้า · {code}</h2><p>{name}</p>
   <label>คำอธิบายที่แสดงในหน้าลูกค้า<textarea rows={7} maxLength={2000} value={draft} disabled={busy} onChange={event=>setDraft(event.target.value)}/></label>
   <p className="small">{draft.length}/2,000 ตัวอักษร</p>{error&&<p role="alert">{error}</p>}
   <div className="actions"><button type="button" disabled={busy} onClick={async()=>{
    setBusy(true);setError('');try{
     const response=await fetch('/api/admin/stock/customer-description',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,name,description:draft,version:saved.version})});
     const result=await response.json();if(!response.ok)throw Error(result.error??'ยังบันทึกไม่ได้');
     setSaved({description:result.description,version:result.version});dialog.current?.close();
    }catch(failure){setError(failure instanceof Error?failure.message:'ยังบันทึกไม่ได้');}finally{setBusy(false);}
   }}>{busy?'กำลังบันทึก…':'บันทึกคำอธิบายสินค้า'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>dialog.current?.close()}>ยกเลิก</button></div>
  </dialog>
 </div>;
}
