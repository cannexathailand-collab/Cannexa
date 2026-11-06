'use client';
import {useState} from 'react';
import {defaultOrderTemplate,draftFields,emptyOrderDraft,extractOrderDraft,orderDraftIssues,renderOrderDraft,type OrderDraft} from '@/lib/order-draft';
type Template={id:string;name:string;body:string};
export function OrderDraftBuilder({seller,initialTemplates,canManage=false}:{seller:string;initialTemplates:Template[];canManage?:boolean}){
 const [draft,setDraft]=useState<OrderDraft>({...emptyOrderDraft,seller}),[source,setSource]=useState(''),[templates,setTemplates]=useState(initialTemplates),[templateId,setTemplateId]=useState('standard'),[lookup,setLookup]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[copied,setCopied]=useState(false),[templateName,setTemplateName]=useState(''),[templateBody,setTemplateBody]=useState(defaultOrderTemplate),[saving,setSaving]=useState(false);
 const selected=templates.find(t=>t.id===templateId)??templates[0],preview=renderOrderDraft(selected?.body??defaultOrderTemplate,draft),issues=orderDraftIssues(draft);
 const field=(key:keyof OrderDraft,value:string)=>{setDraft(d=>({...d,[key]:value}));setCopied(false);};
 async function loadCustomer(){
  setBusy(true);setNotice('');
  try{const response=await fetch('/api/order-drafts/customer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:lookup})});const data=await response.json();if(!response.ok){setNotice(data.error);return;}setDraft(d=>({...d,customerCode:data.customerCode,recipient:data.recipient,phone:data.phone,address:data.address}));setCopied(false);setNotice(data.address?'ดึงข้อมูลแล้ว ตรวจที่อยู่จัดส่งก่อนใช้งาน และกรอกสินค้า / ยอดเงินสำหรับครั้งนี้':'ดึงข้อมูลแล้ว ยังไม่มีที่อยู่จัดส่ง กรุณากรอกเพิ่มเติม');}catch{setNotice('เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่');}finally{setBusy(false);}
 }
 return <div className="order-draft-builder">
  <section className="draft-source"><div className="draft-step"><b>1</b><div><h2>เตรียมข้อมูลลูกค้า</h2><p>ค้นด้วยรหัสลูกค้า หรือวางข้อความที่ได้รับมา</p></div></div>
   <form className="draft-lookup" onSubmit={e=>{e.preventDefault();void loadCustomer();}}><label>รหัสลูกค้า<input value={lookup} onChange={e=>setLookup(e.target.value)} maxLength={20} placeholder="เช่น C0001"/></label><button disabled={busy||!lookup.trim()}>{busy?'กำลังค้นหา…':'ดึงข้อมูลลูกค้า'}</button></form>
   <label>ข้อความจากลูกค้า<textarea aria-label="ข้อความจากลูกค้า" value={source} onChange={e=>setSource(e.target.value)} rows={6} maxLength={12000} placeholder={'วางชื่อ เบอร์โทร ที่อยู่ รายการสินค้า และยอดเงินที่ได้รับมา'}/></label>
   <button type="button" className="secondary" disabled={!source.trim()} onClick={()=>{const parsed=extractOrderDraft(source);setDraft(d=>({...emptyOrderDraft,...parsed,seller:d.seller}));setLookup(parsed.customerCode??'');setCopied(false);setNotice('แยกข้อมูลแล้ว กรุณาตรวจทุกช่อง ช่องที่ไม่พบข้อมูลจะเว้นว่างให้กรอกเพิ่มเติม');}}>แยกข้อมูลลงช่องกรอก</button>
   {notice&&<p className="draft-notice" role="status">{notice}</p>}
  </section>
  <div className="draft-columns"><section className="draft-fields"><div className="draft-step"><b>2</b><div><h2>ตรวจและกรอกข้อมูล</h2><p>สินค้าและยอดเงินใช้ข้อมูลการสั่งซื้อครั้งนี้</p></div></div>
   <div className="draft-field-grid">
    <label>รหัสผู้ขาย<input value={draft.seller} onChange={e=>field('seller',e.target.value)} maxLength={64}/></label>
    <label>รหัสลูกค้า <span>(ไม่บังคับ)</span><input value={draft.customerCode} onChange={e=>field('customerCode',e.target.value.toUpperCase())} maxLength={20}/></label>
    <label>ชื่อผู้รับ<input value={draft.recipient} onChange={e=>field('recipient',e.target.value)} maxLength={200}/></label>
    <label>เบอร์โทร<input type="tel" value={draft.phone} onChange={e=>field('phone',e.target.value)} maxLength={30}/></label>
    <label className="wide">ที่อยู่จัดส่ง<textarea aria-label="ที่อยู่จัดส่ง" value={draft.address} onChange={e=>field('address',e.target.value)} rows={3} maxLength={2000}/></label>
    <label className="wide">สินค้า / จำนวน<textarea aria-label="สินค้า / จำนวน" value={draft.products} onChange={e=>field('products',e.target.value)} rows={3} maxLength={2000} placeholder="เช่น CG13 20g จำนวน 1 ชิ้น"/></label>
    <label>ชำระเงิน<select value={draft.payment} onChange={e=>field('payment',e.target.value)}><option value="">เลือกวิธีชำระเงิน</option><option>COD</option><option>โอน</option><option>เคลม</option></select></label>
    <label>ยอดเงิน (บาท)<input type="number" inputMode="decimal" min="0" step="0.01" value={draft.amount} onChange={e=>field('amount',e.target.value)} placeholder="1260.00"/></label>
   </div>
  </section>
  <section className="draft-preview"><div className="draft-step"><b>3</b><div><h2>ตรวจข้อความส่งงาน</h2><p>ตรวจครบแล้วคัดลอกไปใช้ในกลุ่ม LINE</p></div></div>
   <label>แบบฟอร์ม<select value={templateId} onChange={e=>{setTemplateId(e.target.value);setCopied(false);}}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
   <pre>{preview}</pre>
   {issues.length>0&&<p className="draft-validation">ยังขาดข้อมูล: {issues.join(' · ')}</p>}
   <button type="button" disabled={issues.length>0} onClick={async()=>{try{await navigator.clipboard.writeText(preview);setCopied(true);}catch{setNotice('คัดลอกอัตโนมัติไม่ได้ เลือกข้อความในตัวอย่างแล้วคัดลอกได้');}}}>{copied?'คัดลอกแล้ว ✓':'คัดลอกข้อความส่งงาน'}</button>
   <p className="small muted">ยังไม่บันทึกเป็นออเดอร์หรือส่งข้อความ การรับออเดอร์เกิดเมื่อส่งข้อความให้บอทในกลุ่มตามปกติ</p>
  </section></div>
  {canManage&&<details className="draft-template-settings"><summary>เพิ่มแบบฟอร์มส่งงาน</summary><p>ใช้ชื่อช่องตามที่แสดง รหัสผู้ขายเป็นบรรทัดแรก และรหัสลูกค้าเป็นบรรทัดท้าย</p><form onSubmit={async e=>{e.preventDefault();setSaving(true);try{const response=await fetch('/api/admin/order-templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:templateName,body:templateBody})});const data=await response.json();if(!response.ok){setNotice(data.error);return;}setTemplates(t=>[...t,data.template]);setTemplateId(data.template.id);setTemplateName('');setNotice('บันทึกแบบฟอร์มแล้ว พนักงานสามารถเลือกใช้งานได้');}catch{setNotice('บันทึกแบบฟอร์มไม่ได้ กรุณาลองใหม่');}finally{setSaving(false);}}}><label>ชื่อแบบฟอร์ม<input value={templateName} onChange={e=>setTemplateName(e.target.value)} required maxLength={80}/></label><label>ข้อความแบบฟอร์ม<textarea rows={10} value={templateBody} onChange={e=>setTemplateBody(e.target.value)} maxLength={4000}/></label><p className="small muted">ช่องที่ใช้ได้: {Object.values(draftFields).map(v=>'{{'+v+'}}').join(' · ')}</p><button disabled={saving}>{saving?'กำลังบันทึก…':'บันทึกแบบฟอร์มใหม่'}</button></form></details>}
 </div>;
}
