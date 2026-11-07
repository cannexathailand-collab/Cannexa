'use client';
import {useEffect,useRef,useState} from 'react';
import {defaultOrderTemplate,draftFields,emptyOrderDraft,analyzeOrderDraft,orderDraftIssues,renderOrderDraft,differentDraftAddress,type OrderDraft} from '@/lib/order-draft';
type Template={id:string;name:string;body:string};
type CustomerOption={customerCode:string;recipient:string;phone:string};
const columns=(Object.keys(draftFields) as (keyof OrderDraft)[]);
const customerPoints=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?String(value):'';
export function OrderDraftBuilder({seller,initialTemplates,canManage=false}:{seller:string;initialTemplates:Template[];canManage?:boolean}){
 const [draft,setDraft]=useState<OrderDraft>({...emptyOrderDraft,seller}),[source,setSource]=useState(''),[lookup,setLookup]=useState(''),[ready,setReady]=useState(false),[templates,setTemplates]=useState(initialTemplates),[templateId,setTemplateId]=useState('standard'),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[lookupIssue,setLookupIssue]=useState(''),[copied,setCopied]=useState(false),[templateName,setTemplateName]=useState(''),[templateBody,setTemplateBody]=useState(defaultOrderTemplate),[saving,setSaving]=useState(false);
 const [addressComparison,setAddressComparison]=useState<{incoming:string;stored:string}|null>(null),[addressChoice,setAddressChoice]=useState('');
 const [parseIssues,setParseIssues]=useState<Partial<Record<keyof OrderDraft,string>>>({});
 const [customerOptions,setCustomerOptions]=useState<CustomerOption[]>([]),[identityStatus,setIdentityStatus]=useState<'idle'|'found'|'none'|'skipped'|'created'|'error'>('idle'),[identityBusy,setIdentityBusy]=useState(false);
 const [copyNeedsCode,setCopyNeedsCode]=useState(false);
 const [identityError,setIdentityError]=useState('');
 const resultDialog=useRef<HTMLDialogElement>(null);
 const customerDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(ready&&!busy&&!resultDialog.current?.open)resultDialog.current?.showModal();},[ready,busy,draft]);
 const dataIssues=[...orderDraftIssues(draft),...Object.values(parseIssues),...(lookupIssue?[lookupIssue]:[]),...(addressComparison&&!addressChoice?['เลือกที่อยู่จัดส่งจากสองรายการก่อนคัดลอก']:[])];
 const customerPromptReady=!draft.customerCode&&dataIssues.length===0;
 useEffect(()=>{if(ready&&!busy&&customerPromptReady&&!identityBusy&&(identityStatus==='none'||identityStatus==='found'||identityStatus==='skipped'&&copyNeedsCode)){if(!customerDialog.current?.open)customerDialog.current?.showModal();}else customerDialog.current?.close();},[ready,busy,customerPromptReady,identityStatus,identityBusy,copyNeedsCode]);
 useEffect(()=>{
  if(!ready||busy||!customerPromptReady)return;
  let active=true;
  setIdentityBusy(true);setIdentityError('');setCustomerOptions([]);setIdentityStatus('idle');
  void (async()=>{try{
   const response=await fetch('/api/order-drafts/identity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search',phone:draft.phone})}),data=await response.json();
   if(!active)return;if(!response.ok)throw new Error(data.error||'ค้นหาลูกค้าไม่สำเร็จ');
   if(data.customers.length===1){
    const profileResponse=await fetch('/api/order-drafts/customer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:data.customers[0].customerCode})}),profile=await profileResponse.json();
    if(!active)return;if(!profileResponse.ok)throw new Error(profile.error||'ดึงข้อมูลลูกค้าไม่สำเร็จ');
    if(differentDraftAddress(draft.address,profile.address)){setAddressComparison({incoming:draft.address,stored:profile.address});setAddressChoice('');}
    setDraft(d=>({...d,customerCode:profile.customerCode,points:customerPoints(profile.points)}));setLookupIssue('');setIdentityStatus('found');setNotice('พบลูกค้าจากเบอร์โทรและเติมรหัสเดิมแล้ว ตรวจชื่อและที่อยู่ก่อนส่งงาน');
   }else{setCustomerOptions(data.customers);setIdentityStatus(data.customers.length?'found':'none');}
  }catch(error){if(active){setIdentityStatus('error');setIdentityError(error instanceof Error?error.message:'ค้นหาลูกค้าไม่สำเร็จ');}}finally{if(active)setIdentityBusy(false);}})();
  return()=>{active=false;setIdentityBusy(false);};
 },[ready,busy,customerPromptReady,draft.phone]);
 const formatIssues=dataIssues.filter(issue=>issue?.includes('เบอร์โทร')||issue?.includes('ไปรษณีย์'));
 const selected=templates.find(t=>t.id===templateId)??templates[0],preview=renderOrderDraft(selected?.body??defaultOrderTemplate,draft),issues=[...dataIssues,...(customerPromptReady&&identityStatus!=='skipped'?['เลือกรหัสลูกค้า สร้างใหม่ หรือกดข้ามก่อน']:[])];
 function field(key:keyof OrderDraft,value:string){setDraft(d=>({...d,[key]:value,...(key==='customerCode'?{points:''}:{})}));setParseIssues(previous=>{const next={...previous};delete next[key];return next;});setCopied(false);if(key==='customerCode')setLookupIssue('');if(key==='address'&&addressComparison)setAddressChoice('custom');if(key==='phone'&&!draft.customerCode){setCustomerOptions([]);setIdentityStatus('idle');}}
 async function writeClipboard(text=preview){try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setNotice('คัดลอกอัตโนมัติไม่ได้ เปิดข้อความด้านล่างแล้วเลือกคัดลอกได้');}}
 function skipCustomer(){setIdentityStatus('skipped');setCopyNeedsCode(false);customerDialog.current?.close();}
 async function copy(){if(!draft.customerCode){setCopyNeedsCode(true);return;}await writeClipboard();}
 async function useCustomer(code:string){setIdentityBusy(true);setIdentityError('');try{
  const response=await fetch('/api/order-drafts/customer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})}),data=await response.json();if(!response.ok){setIdentityError(data.error);return;}
  if(differentDraftAddress(draft.address,data.address)){setAddressComparison({incoming:draft.address,stored:data.address});setAddressChoice('');}
  setDraft(d=>({...d,customerCode:data.customerCode,points:customerPoints(data.points),recipient:d.recipient||data.recipient,phone:d.phone||data.phone,address:d.address||data.address}));setLookup(data.customerCode);setLookupIssue('');setParseIssues(p=>{const next={...p};delete next.customerCode;return next;});setNotice('เลือกรหัสลูกค้าเดิมแล้ว ตรวจชื่อและที่อยู่ให้ตรงกับผู้รับ');
 }catch{setIdentityError('ดึงข้อมูลลูกค้าไม่สำเร็จ');}finally{setIdentityBusy(false);}}
 async function createCustomer(){setIdentityBusy(true);setIdentityError('');try{
  const response=await fetch('/api/order-drafts/identity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:draft.recipient,phone:draft.phone,address:draft.address})}),data=await response.json();
  if(response.status===409){setCustomerOptions(data.customers);setIdentityStatus('found');setIdentityError('พบลูกค้าเดิม จึงไม่ได้สร้างซ้ำ กรุณาเลือกรหัสเดิม');return;}
  if(!response.ok){setIdentityError(data.error);return;}
  const createdDraft={...draft,customerCode:data.customer.customerCode,points:'0'};
  setDraft(createdDraft);setLookup(data.customer.customerCode);setIdentityStatus('created');setNotice('สร้างรหัสลูกค้าและบันทึกในระบบแล้ว ยังไม่ได้สร้างออเดอร์');setCopied(false);
  await writeClipboard(renderOrderDraft(selected?.body??defaultOrderTemplate,createdDraft));
 }catch{setIdentityError('สร้างรหัสไม่สำเร็จ ลองค้นหาจากเบอร์ก่อนทำซ้ำ');}finally{setIdentityBusy(false);}}
 async function analyze(){
  setBusy(true);setCopied(false);setNotice('');setLookupIssue('');setAddressComparison(null);setAddressChoice('');setCustomerOptions([]);setIdentityStatus('idle');setCopyNeedsCode(false);setIdentityError('');
  const analysis=analyzeOrderDraft(source),parsed=analysis.fields,next={...emptyOrderDraft,...parsed,seller,points:''};delete analysis.issues.points;setParseIssues(analysis.issues);if(!parsed.customerCode&&lookup.trim())parsed.customerCode=lookup.trim().toUpperCase();next.customerCode=parsed.customerCode??'';let info='จัดข้อมูลแล้ว ตรวจคอลัมน์ด้านล่างก่อนคัดลอก';
  if(parsed.customerCode){try{const response=await fetch('/api/order-drafts/customer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:parsed.customerCode})});const data=await response.json();if(response.ok){next.customerCode=data.customerCode;next.points=customerPoints(data.points);next.recipient=parsed.recipient||data.recipient;next.phone=parsed.phone||data.phone;next.address=parsed.address||data.address;if(differentDraftAddress(parsed.address??'',data.address??''))setAddressComparison({incoming:parsed.address!,stored:data.address});info='จัดข้อมูลและเติมข้อมูลจากรหัสลูกค้าแล้ว ตรวจที่อยู่ สินค้า และยอดเงินสำหรับครั้งนี้';}else{setLookupIssue(data.error);info=data.error;}}catch{setLookupIssue('ยังตรวจรหัสลูกค้าไม่ได้');info='ยังตรวจรหัสลูกค้าไม่ได้ กรุณาลองใหม่';}}
  setDraft(next);setLookup(next.customerCode);setReady(true);setNotice(info);setBusy(false);
 }
 return <div className="order-draft-builder draft-single-flow">
  <section className="draft-source"><h2>วางข้อมูลดิบของลูกค้า</h2><p className="muted">วางข้อความทั้งหมดที่ได้รับมา หรือใส่รหัสลูกค้า ระบบจะแยกข้อมูลลงคอลัมน์ให้ตรวจและคัดลอก</p>
   <form className="draft-lookup" onSubmit={e=>{e.preventDefault();void analyze();}}><label>ดึงจากรหัสลูกค้า <input value={lookup} onChange={e=>setLookup(e.target.value)} disabled={busy} maxLength={20} placeholder="เช่น C0001"/></label><button disabled={busy||!lookup.trim()}>{busy?'กำลังตรวจสอบ…':'ดึงข้อมูลลูกค้า'}</button></form>
   <label className="sr-only" htmlFor="raw-order-data">ข้อมูลดิบของลูกค้า</label><textarea id="raw-order-data" aria-label="ข้อมูลดิบของลูกค้า" disabled={busy} value={source} onChange={e=>setSource(e.target.value)} rows={8} maxLength={12000} placeholder={'วางข้อมูลลูกค้าที่นี่ เช่น\nชื่อผู้รับ: ...\nเบอร์โทร: ...\nที่อยู่: ...\nสินค้า: ...\nยอดเงิน: ...\nชำระเงิน: COD\nรหัสลูกค้า: C0001'}/>
   <div className="draft-source-actions"><button type="button" disabled={busy||!source.trim()&&!lookup.trim()} onClick={analyze}>{busy?'กำลังตรวจสอบ…':'ตรวจสอบและจัดข้อมูล'}</button>{ready&&<button type="button" className="secondary" onClick={()=>resultDialog.current?.showModal()}>ดูผลลัพธ์ล่าสุด</button>}<span>ข้อมูลที่อ่านไม่ได้จะเว้นไว้ให้เติม</span></div>
  </section>
  {ready&&<dialog ref={resultDialog} className="draft-result-dialog" aria-labelledby="draft-result-title" onClick={e=>{if(e.target!==e.currentTarget)return;const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)resultDialog.current?.close();}}>
   <header className="draft-result-header"><div><h2 id="draft-result-title">{formatIssues.length?'ข้อมูลติดต่อยังไม่ครบ':'ผลลัพธ์แยกคอลัมน์'}</h2><p>{formatIssues.length?'แก้เบอร์โทรหรือรหัสไปรษณีย์ก่อนดำเนินการ':issues.length?'ตรวจและเติมช่องที่ยังขาด':'ข้อมูลครบ พร้อมคัดลอกส่งงาน'}</p></div><button type="button" className="secondary" aria-label="ปิดผลลัพธ์" onClick={()=>resultDialog.current?.close()}>ปิด ×</button></header>
   <section className="draft-column-output" id="draft-preview">
   <header><label>แบบฟอร์ม<select value={templateId} onChange={e=>{setTemplateId(e.target.value);setCopied(false);}}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></header>
   {notice&&<p className="draft-notice" role="status">{notice}</p>}
   {customerPromptReady&&identityBusy&&<p role="status">กำลังค้นหาลูกค้าจากเบอร์โทร…</p>}
   {customerPromptReady&&identityStatus==='error'&&<p role="alert">{identityError} กรุณากดตรวจสอบและจัดข้อมูลอีกครั้ง ยังไม่สามารถสร้างลูกค้าได้จนกว่าจะค้นหาสำเร็จ</p>}
   {formatIssues.length>0&&<div className="draft-format-alert" role="alert"><strong>กรุณาตรวจสอบข้อมูล</strong><ul>{formatIssues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>}
   {customerPromptReady&&!identityBusy&&(identityStatus==='none'||identityStatus==='found'||identityStatus==='skipped')&&<button type="button" className="secondary" onClick={()=>{setCopyNeedsCode(true);}}>จัดการรหัสลูกค้า</button>}
   {addressComparison&&<fieldset className="draft-address-compare"><legend>ที่อยู่ในข้อความต่างจากข้อมูลเดิม</legend><p>ลูกค้าอาจส่งไปที่อยู่ใหม่ โปรดเลือกที่อยู่สำหรับออเดอร์นี้</p><div>{([['incoming','ใช้ที่อยู่จากข้อความลูกค้า',addressComparison.incoming],['stored','ใช้ที่อยู่ที่บันทึกไว้',addressComparison.stored]] as const).map(([choice,label,address])=><label key={choice} className={addressChoice===choice?'selected':''}><span><input type="radio" name="address-choice" checked={addressChoice===choice} onChange={()=>{setAddressChoice(choice);setDraft(d=>({...d,address}));setCopied(false);}}/>{label}</span><pre>{address}</pre></label>)}</div>{addressChoice==='custom'&&<p>ใช้ที่อยู่ที่คุณแก้ไขในคอลัมน์ด้านล่าง</p>}<small>การเลือกนี้ใช้เฉพาะข้อความส่งงาน ไม่เปลี่ยนที่อยู่เดิมในระบบ</small></fieldset>}
   <table><thead><tr><th>หัวข้อ</th><th>ข้อมูลสำหรับส่งงาน <span>แก้ไขได้</span></th></tr></thead><tbody>{columns.map(key=><tr key={key} className={!draft[key]&&key!=='customerCode'&&key!=='points'?'draft-missing':''}><th scope="row">{draftFields[key]}{key==='customerCode'&&<small>ไม่บังคับ</small>}</th><td>{key==='payment'?<select aria-label={draftFields[key]} value={draft[key]} onChange={e=>field(key,e.target.value)}><option value="">เลือกวิธีชำระเงิน</option><option>COD</option><option>โอน</option><option>เคลม</option></select>:key==='address'||key==='products'?<textarea aria-label={draftFields[key]} rows={key==='address'?3:2} value={draft[key]} onChange={e=>field(key,e.target.value)} maxLength={2000}/>:<input aria-label={draftFields[key]} readOnly={key==='points'} placeholder={key==='points'?'รอดึงข้อมูลลูกค้า':undefined} type={key==='amount'?'number':key==='phone'?'tel':'text'} inputMode={key==='amount'?'decimal':undefined} min={key==='amount'?'0':undefined} step={key==='amount'?'0.01':undefined} value={draft[key]} onChange={e=>field(key,e.target.value)} maxLength={key==='amount'?undefined:200}/>}</td></tr>)}</tbody></table>
   {issues.length>0&&<p className="draft-validation">{issues.join(' · ')}</p>}
   <details className="draft-copy-preview"><summary>ดูข้อความที่จะคัดลอก</summary><pre>{preview}</pre></details>
   <p className="small muted">คัดลอกแล้วนำไปวางในกลุ่มส่งงาน ยังไม่บันทึกเป็นออเดอร์จนกว่าจะส่งให้บอทตามปกติ</p>
  </section><footer className="draft-result-footer"><span>{issues.length?'ยังมีข้อมูลให้ตรวจสอบ':'พร้อมนำไปวางในกลุ่มส่งงาน'}</span><button type="button" disabled={issues.length>0||identityBusy} onClick={copy}>{copied?'คัดลอกแล้ว ✓':'คัดลอกข้อความส่งงาน'}</button></footer></dialog>}
  {ready&&<dialog ref={customerDialog} className="draft-customer-dialog" aria-labelledby="draft-customer-title" onCancel={e=>{e.preventDefault();if(!identityBusy)skipCustomer();}}>
   <header><h2 id="draft-customer-title">{customerOptions.length?'เลือกลูกค้าที่ตรงกัน':'สร้างรหัสลูกค้าใหม่หรือไม่?'}</h2><button type="button" className="secondary" disabled={identityBusy} aria-label="ปิดคำถามรหัสลูกค้า" onClick={skipCustomer}>ปิด ×</button></header>
   {identityError&&<p className="draft-notice" role="alert">{identityError}</p>}
<section className="draft-customer-resolution" id="customer-code-prompt"><h3>{copyNeedsCode?'ยังไม่มีรหัสลูกค้า ก่อนคัดลอกต้องการสร้างไหม?':'ยังไม่มีรหัสลูกค้า'}</h3><p>{identityStatus==='found'?'พบข้อมูลที่ใช้เบอร์นี้ ตรวจชื่อแล้วเลือกรหัสของลูกค้า':identityStatus==='none'?'ไม่พบลูกค้าจากเบอร์นี้ สามารถสร้างรหัสใหม่ได้':identityStatus==='skipped'?'เลือกส่งงานโดยไม่ระบุรหัสลูกค้า':'ค้นหาจากเบอร์โทรก่อน เพื่อป้องกันสร้างลูกค้าซ้ำ'}</p>
    {(identityStatus==='found'||copyNeedsCode&&customerOptions.length>0)&&<div className="draft-customer-options">{customerOptions.map(c=><div key={c.customerCode}><span><strong>{c.customerCode}</strong> · {c.recipient||'ยังไม่ระบุชื่อ'}<small>{c.phone}</small></span><button type="button" className="secondary" disabled={identityBusy} onClick={()=>useCustomer(c.customerCode)}>ใช้รหัสนี้</button></div>)}</div>}
    <div className="draft-customer-actions">{(identityStatus==='none'||identityStatus==='skipped'&&!customerOptions.length)&&<button type="button" disabled={identityBusy||!draft.recipient||!draft.phone} onClick={createCustomer}>{identityBusy?'กำลังสร้างและคัดลอก…':'คัดลอกและสร้างลูกค้าใหม่'}</button>}{copyNeedsCode?<button type="button" className="secondary" disabled={identityBusy} onClick={async()=>{skipCustomer();await writeClipboard();}}>คัดลอกโดยไม่ใส่รหัส</button>:<button type="button" className="secondary" disabled={identityBusy} onClick={skipCustomer}>ยังไม่สร้าง ข้ามก่อน</button>}</div><small>สร้างรหัสในระบบแล้วคัดลอกข้อความพร้อมรหัสให้ทันที ยังไม่สร้างออเดอร์</small>
   </section>
  </dialog>}
  {canManage&&<details className="draft-template-settings"><summary>เพิ่มแบบฟอร์มส่งงาน</summary><p>ใช้ชื่อช่องตามที่แสดง รหัสผู้ขายเป็นบรรทัดแรก และ Green Coin อยู่ใต้รหัสลูกค้าเป็นบรรทัดท้าย</p><form onSubmit={async e=>{e.preventDefault();setSaving(true);try{const response=await fetch('/api/admin/order-templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:templateName,body:templateBody})});const data=await response.json();if(!response.ok){setNotice(data.error);return;}setTemplates(t=>[...t,data.template]);setTemplateId(data.template.id);setTemplateName('');setNotice('บันทึกแบบฟอร์มแล้ว');}catch{setNotice('บันทึกแบบฟอร์มไม่ได้');}finally{setSaving(false);}}}><label>ชื่อแบบฟอร์ม<input value={templateName} onChange={e=>setTemplateName(e.target.value)} required maxLength={80}/></label><label>ข้อความแบบฟอร์ม<textarea rows={10} value={templateBody} onChange={e=>setTemplateBody(e.target.value)} maxLength={4000}/></label><button disabled={saving}>{saving?'กำลังบันทึก…':'บันทึกแบบฟอร์มใหม่'}</button></form></details>}
 </div>;
}
