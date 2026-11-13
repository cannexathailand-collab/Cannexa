'use client';
import {useEmployeeLanguage} from '@/app/my-performance/language';
import {PopupDetails} from '@/app/popup-details';
import {CustomerLineLink} from './customer-line-link';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {defaultOrderTemplate,draftFields,emptyOrderDraft,analyzeOrderDraft,orderDraftIssues,renderOrderDraft,differentDraftAddress,type OrderDraft} from '@/lib/order-draft';
import {orderStockItems} from '@/lib/order-stock-items';
import {moneySatang} from '@/lib/shipment-matching';
import {validContactPhones} from '@/lib/contact-phones';
type Template={id:string;name:string;body:string};
type CustomerOption={customerCode:string;recipient:string;phone:string};
const columns=(Object.keys(draftFields) as (keyof OrderDraft)[]);
const customerPoints=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?String(value):'';
async function draftRequest(path:string,body:unknown){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{let response:Response;try{response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});}catch{throw Error('เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่');}
  let data;try{data=await response.json();}catch{throw Error('อ่านข้อมูลจากระบบไม่สำเร็จ กรุณาลองใหม่');}
  if(response.status===401||response.status===403)throw Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  if(response.status===429)throw Error('ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');
  return {response,data};
 }catch(error){if(controller.signal.aborted)throw Error('การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่');throw error;}finally{clearTimeout(timer);}
}
function requireCustomerCode(customer:{customerCode?:unknown}|null|undefined){if(!customer||typeof customer.customerCode!=='string'||!/^(?:[A-Z]{1,3}\d{4,8}|CUS-\d{8})$/.test(customer.customerCode))throw Error('ข้อมูลรหัสลูกค้าไม่สมบูรณ์ กรุณาลองใหม่');}
type DirectOrders={groups:{id:string;name:string}[];sellers:{username:string}[];endpoint?:string;detailBase?:string;lockSeller?:boolean};
export function OrderDraftBuilder({seller,initialTemplates,canManage=false,directOrders}:{seller:string;initialTemplates:Template[];canManage?:boolean;directOrders?:DirectOrders}){
 const {t,locale}=useEmployeeLanguage();

 const router=useRouter();
 const [draft,setDraft]=useState<OrderDraft>({...emptyOrderDraft,seller}),[source,setSource]=useState(''),[lookup,setLookup]=useState(''),[ready,setReady]=useState(false),[templates,setTemplates]=useState(initialTemplates),[templateId,setTemplateId]=useState('standard'),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[lookupIssue,setLookupIssue]=useState(''),[copied,setCopied]=useState(false),[templateName,setTemplateName]=useState(''),[templateBody,setTemplateBody]=useState(defaultOrderTemplate),[saving,setSaving]=useState(false);
 const [addressComparison,setAddressComparison]=useState<{incoming:string;stored:string}|null>(null),[addressChoice,setAddressChoice]=useState('');
 const [parseIssues,setParseIssues]=useState<Partial<Record<keyof OrderDraft,string>>>({});
 const [customerOptions,setCustomerOptions]=useState<CustomerOption[]>([]),[identityStatus,setIdentityStatus]=useState<'idle'|'found'|'none'|'dismissed'|'created'|'error'>('idle'),[identityBusy,setIdentityBusy]=useState(false);
 const [identityError,setIdentityError]=useState('');
 const [identityRequest,setIdentityRequest]=useState(0);
 const [creationResult,setCreationResult]=useState<{code:string;copied:boolean}|null>(null);
 const [resultVisible,setResultVisible]=useState(false);
 const latestDraft=useRef(draft);latestDraft.current=draft;
 const resultDialog=useRef<HTMLDialogElement>(null);
 const customerDialog=useRef<HTMLDialogElement>(null);
 const successDialog=useRef<HTMLDialogElement>(null);
 const [team,setTeam]=useState(''),[directSaving,setDirectSaving]=useState(false),[directSaved,setDirectSaved]=useState<{orderId:string;orderNumber:string}|null>(null);
 const directRequest=useRef<{fingerprint:string;key:string}|null>(null),directSending=useRef(false);
 const [slip,setSlip]=useState(''),[slipName,setSlipName]=useState(''),[readingSlip,setReadingSlip]=useState(false);
 const slipReader=useRef<FileReader|null>(null);
 useEffect(()=>{if(resultVisible&&ready&&!busy&&!resultDialog.current?.open)resultDialog.current?.showModal();else if(!resultVisible)resultDialog.current?.close();},[resultVisible,ready,busy]);
 const dataIssues=[...orderDraftIssues(draft,{requireCustomerCode:false}),...Object.values(parseIssues),...(directOrders&&draft.payment==='เคลม'?['เลือกชำระเงินเป็น COD หรือโอน']:[]),...(lookupIssue?[lookupIssue]:[]),...(addressComparison&&!addressChoice?['เลือกที่อยู่จัดส่งจากสองรายการก่อนคัดลอก']:[])];
 const customerPromptReady=!draft.customerCode&&!!validContactPhones(draft.phone);
 useEffect(()=>{if(resultVisible&&ready&&!busy&&customerPromptReady&&!identityBusy&&(identityStatus==='none'||identityStatus==='found')){if(!customerDialog.current?.open)customerDialog.current?.showModal();}else customerDialog.current?.close();},[resultVisible,ready,busy,customerPromptReady,identityStatus,identityBusy]);
 useEffect(()=>{if(creationResult){if(!successDialog.current?.open)successDialog.current?.showModal();}else successDialog.current?.close();},[creationResult]);
 useEffect(()=>{
  if(!ready||busy||!customerPromptReady)return;
  let active=true;
  setIdentityBusy(true);setIdentityError('');setCustomerOptions([]);setIdentityStatus('idle');
  void (async()=>{try{
   const {response,data}=await draftRequest('/api/order-drafts/identity',{action:'search',phone:draft.phone});
   if(!active)return;if(!response.ok)throw new Error(data.error||'ค้นหาลูกค้าไม่สำเร็จ');
   if(!Array.isArray(data.customers))throw Error('อ่านรายชื่อลูกค้าไม่สำเร็จ กรุณาลองใหม่');
   data.customers.forEach(requireCustomerCode);
   if(data.customers.length===1){
    const {response:profileResponse,data:profile}=await draftRequest('/api/order-drafts/customer',{code:data.customers[0].customerCode});
    if(!active)return;if(!profileResponse.ok)throw new Error(profile.error||'ดึงข้อมูลลูกค้าไม่สำเร็จ');
    requireCustomerCode(profile);
    if(differentDraftAddress(latestDraft.current.address,profile.address)){setAddressComparison({incoming:latestDraft.current.address,stored:profile.address});setAddressChoice('');}
    setDraft(d=>({...d,customerCode:profile.customerCode,points:customerPoints(profile.points)}));setLookupIssue('');setIdentityStatus('found');setNotice('พบลูกค้าจากเบอร์โทรและเติมรหัสเดิมแล้ว ตรวจชื่อและที่อยู่ก่อนส่งงาน');
   }else{setCustomerOptions(data.customers);setIdentityStatus(data.customers.length?'found':'none');}
  }catch(error){if(active){setIdentityStatus('error');setIdentityError(error instanceof Error?error.message:'ค้นหาลูกค้าไม่สำเร็จ');}}finally{if(active)setIdentityBusy(false);}})();
  return()=>{active=false;setIdentityBusy(false);};
 },[ready,busy,customerPromptReady,draft.phone,identityRequest]);
 const formatIssues=dataIssues.filter(issue=>issue?.includes('เบอร์โทร')||issue?.includes('ไปรษณีย์'));
 const selected=templates.find(t=>t.id===templateId)??templates[0],preview=renderOrderDraft(selected?.body??defaultOrderTemplate,draft),issues=[...dataIssues,...(!draft.customerCode?['ต้องมีรหัสลูกค้าก่อนคัดลอกข้อความ']:[])];
 function field(key:keyof OrderDraft,value:string){if(key==='payment'&&value!=='โอน')readSlip();setDraft(d=>({...d,[key]:value,...(key==='customerCode'?{points:''}:{})}));setParseIssues(previous=>{const next={...previous};delete next[key];return next;});setCopied(false);if(key==='customerCode')setLookupIssue('');if(key==='address'&&addressComparison)setAddressChoice('custom');if(key==='phone'&&!draft.customerCode){setCustomerOptions([]);setIdentityStatus('idle');}}
 async function writeClipboard(text=preview,customerCode=draft.customerCode){if(!customerCode.trim()||dataIssues.length){setNotice('ต้องมีรหัสลูกค้าที่ถูกต้องและข้อมูลครบก่อนคัดลอกข้อความ');return false;}try{await navigator.clipboard.writeText(text);setCopied(true);return true;}catch{setNotice('คัดลอกอัตโนมัติไม่ได้ เปิดข้อความด้านล่างแล้วเลือกคัดลอกได้');return false;}}
 function dismissCustomer(){setIdentityStatus('dismissed');customerDialog.current?.close();}
 function openCustomer(){
  if(lookupIssue){setLookup('');setLookupIssue('');setDraft(d=>({...d,customerCode:'',points:''}));setParseIssues(p=>{const next={...p};delete next.customerCode;return next;});setIdentityStatus('idle');setIdentityRequest(value=>value+1);return;}
  if(!validContactPhones(draft.phone)){setNotice('กรุณากรอกเบอร์โทรลูกค้าให้ครบก่อนค้นหาหรือสร้างรหัส');return;}
  if(identityStatus==='idle'||identityStatus==='error'){setIdentityRequest(value=>value+1);return;}
  setIdentityStatus(customerOptions.length?'found':'none');
 }
 async function copy(){if(!draft.customerCode){setNotice('ต้องมีรหัสลูกค้าก่อนคัดลอกข้อความ');return;}await writeClipboard();}
 async function submitDirectOrder(){
  if(!directOrders||directSending.current||readingSlip||issues.length||!team)return;
  if(draft.payment==='โอน'&&!slip){setNotice('กรุณาแนบรูปหลักฐานการโอนเงิน');return;}
  const stock=orderStockItems('สินค้า\n'+draft.products),amountSatang=moneySatang(draft.amount);
  if(stock.issues.length||amountSatang===null){setNotice(stock.issues.join(' · ')||'กรุณาตรวจยอดเงิน');return;}
  const payload={groupId:team,sellerCode:draft.seller,customerCode:draft.customerCode,recipient:draft.recipient,phone:draft.phone,address:draft.address,payment:draft.payment,amountSatang,items:stock.items.map(item=>({code:item.code,grams:item.quantityMilliG/1000})),...(draft.payment==='โอน'?{slip}:{})};
  const fingerprint=JSON.stringify(payload);
  if(directRequest.current?.fingerprint!==fingerprint)directRequest.current={fingerprint,key:crypto.randomUUID()};
  directSending.current=true;setDirectSaving(true);setNotice('');
  try{
   const response=await fetch(directOrders.endpoint??'/api/admin/orders/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,requestKey:directRequest.current.key}),signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok){directRequest.current=null;throw Error(result.error);}
   setDirectSaved(result);setNotice('บันทึกออเดอร์ '+result.orderNumber+' แล้ว'+(result.createdAt?' · วันที่ '+new Date(result.createdAt).toLocaleString(locale,{timeZone:'Asia/Bangkok'}):'')+(result.status==='NEEDS_REVIEW'?' · มีข้อมูลที่ต้องตรวจสอบ':''));router.push(directOrders.detailBase?directOrders.detailBase+encodeURIComponent(result.orderId):'/admin/orders/list?'+new URLSearchParams({status:result.status==='NEEDS_REVIEW'?'REVIEW':'WAITING',q:result.orderNumber,focus:result.orderId}));
  }catch(error){setNotice(error instanceof Error?error.message:'ยังยืนยันผลไม่ได้ กรุณาลองบันทึกอีกครั้ง');}finally{directSending.current=false;setDirectSaving(false);}
 }
 function readSlip(file?:File){
  slipReader.current?.abort();slipReader.current=null;setSlip('');setSlipName('');setReadingSlip(false);
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024){setNotice('รูปสลิปต้องเป็น JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB');return;}
  const reader=new FileReader();slipReader.current=reader;setReadingSlip(true);
  reader.onload=async()=>{
   try{
    if(typeof reader.result!=='string')throw Error();
    const image=new Image();image.src=reader.result;await image.decode();
    if(slipReader.current!==reader)return;
    setSlip(reader.result);setSlipName(file.name);
   }catch{if(slipReader.current===reader)setNotice('อ่านรูปสลิปไม่ได้ กรุณาเลือกไฟล์ใหม่');}
   finally{if(slipReader.current===reader)setReadingSlip(false);}
  };
  reader.onerror=()=>{if(slipReader.current===reader){setNotice('อ่านรูปสลิปไม่ได้ กรุณาเลือกไฟล์ใหม่');setReadingSlip(false);}};
  reader.readAsDataURL(file);
 }
 async function useCustomer(code:string){setIdentityBusy(true);setIdentityError('');try{
  const {response,data}=await draftRequest('/api/order-drafts/customer',{code});if(!response.ok){setIdentityError(data.error);return;}
  requireCustomerCode(data);
  if(differentDraftAddress(draft.address,data.address)){setAddressComparison({incoming:draft.address,stored:data.address});setAddressChoice('');}
  setDraft(d=>({...d,customerCode:data.customerCode,points:customerPoints(data.points),recipient:d.recipient||data.recipient,phone:d.phone||data.phone,address:d.address||data.address}));setLookupIssue('');setParseIssues(p=>{const next={...p};delete next.customerCode;return next;});setNotice('เลือกรหัสลูกค้าเดิมแล้ว ตรวจชื่อและที่อยู่ให้ตรงกับผู้รับ');
 }catch(error){setIdentityError(error instanceof Error?error.message:'ดึงข้อมูลลูกค้าไม่สำเร็จ');}finally{setIdentityBusy(false);}}
 async function createCustomer(){setIdentityBusy(true);setIdentityError('');try{
  const {response,data}=await draftRequest('/api/order-drafts/identity',{action:'create',name:draft.recipient,phone:draft.phone,address:draft.address});
  if(response.status===409){setCustomerOptions(data.customers);setIdentityStatus('found');setIdentityError('พบลูกค้าเดิม จึงไม่ได้สร้างซ้ำ กรุณาเลือกรหัสเดิม');return;}
  if(!response.ok){setIdentityError(data.error);return;}
  requireCustomerCode(data.customer);
  const createdDraft={...draft,customerCode:data.customer.customerCode,points:'0'};
  setDraft(createdDraft);setIdentityStatus('created');setNotice('สร้างรหัสลูกค้าและบันทึกในระบบแล้ว ยังไม่ได้สร้างออเดอร์');setCopied(false);
  if(directOrders)return;
  const copied=await writeClipboard(renderOrderDraft(selected?.body??defaultOrderTemplate,createdDraft),createdDraft.customerCode);
  setCreationResult({code:createdDraft.customerCode,copied});
 }catch(error){setIdentityError((error instanceof Error?error.message:'ยังยืนยันผลการสร้างไม่ได้')+' ระบบจะตรวจลูกค้าเดิมก่อนทำรายการซ้ำ');}finally{setIdentityBusy(false);}}
 async function analyze(){
  setBusy(true);setCopied(false);setCreationResult(null);setNotice('');setLookupIssue('');setAddressComparison(null);setAddressChoice('');setCustomerOptions([]);setIdentityStatus('idle');setIdentityError('');
  setDirectSaved(null);directRequest.current=null;readSlip();
  const analysis=analyzeOrderDraft(source),parsed=analysis.fields,next={...emptyOrderDraft,...parsed,seller:directOrders?.lockSeller?seller:directOrders?parsed.seller||draft.seller:seller,points:''};delete analysis.issues.points;setParseIssues(analysis.issues);if(!parsed.customerCode&&!analysis.issues.customerCode&&lookup.trim())parsed.customerCode=lookup.trim().toUpperCase();next.customerCode=parsed.customerCode??'';let info=directOrders?'จัดข้อมูลแล้ว ตรวจรายละเอียดและเลือกทีมก่อนบันทึกออเดอร์':'จัดข้อมูลแล้ว ตรวจคอลัมน์ด้านล่างก่อนคัดลอก';
  if(parsed.customerCode){try{const {response,data}=await draftRequest('/api/order-drafts/customer',{code:parsed.customerCode});if(response.ok){requireCustomerCode(data);next.customerCode=data.customerCode;next.points=customerPoints(data.points);next.recipient=analysis.issues.recipient?'':parsed.recipient||data.recipient;next.phone=analysis.issues.phone?'':parsed.phone||data.phone;next.address=analysis.issues.address?'':parsed.address||data.address;if(differentDraftAddress(parsed.address??'',data.address??''))setAddressComparison({incoming:parsed.address!,stored:data.address});info='จัดข้อมูลและเติมข้อมูลจากรหัสลูกค้าแล้ว ตรวจที่อยู่ สินค้า และยอดเงินสำหรับครั้งนี้';}else{setLookupIssue(data.error);info=data.error;}}catch(error){const message=error instanceof Error?error.message:'ยังตรวจรหัสลูกค้าไม่ได้';setLookupIssue(message);info=message;}}
  setDraft(next);setReady(true);setResultVisible(true);setNotice(info);setIdentityRequest(value=>value+1);setBusy(false);
 }
 return <div className="order-draft-builder draft-single-flow">
  <section className="draft-source"><h2>{t("วางข้อมูลดิบของลูกค้า")}</h2><p className="muted">{directOrders?t('วางข้อความลูกค้า ระบบจะแยกข้อมูลให้ตรวจ แล้วบันทึกออเดอร์เข้าระบบจากหน้านี้ได้'):t('วางข้อความทั้งหมดที่ได้รับมา หรือใส่รหัสลูกค้า ระบบจะแยกข้อมูลลงคอลัมน์ให้ตรวจและคัดลอก')}</p>
   <form className="draft-lookup" onSubmit={e=>{e.preventDefault();void analyze();}}><label>{t("ดึงจากรหัสลูกค้า ")}<input value={lookup} onChange={e=>setLookup(e.target.value)} disabled={busy} maxLength={20} placeholder={t("เช่น C0001")}/></label><button disabled={busy||!lookup.trim()}>{busy?t('กำลังตรวจสอบ…'):t('ดึงข้อมูลลูกค้า')}</button></form>
   <label className="sr-only" htmlFor="raw-order-data">{t("ข้อมูลดิบของลูกค้า")}</label><textarea id="raw-order-data" aria-label={t("ข้อมูลดิบของลูกค้า")} disabled={busy} value={source} onChange={e=>{setSource(e.target.value);if(directOrders){setReady(false);setResultVisible(false);setDirectSaved(null);setLookup('');directRequest.current=null;}}} rows={8} maxLength={12000} placeholder={t('วางข้อมูลลูกค้าที่นี่ เช่น\nชื่อผู้รับ: ...\nเบอร์โทร: ...\nที่อยู่: ...\nสินค้า: ...\nยอดเงิน: ...\nชำระเงิน: COD\nรหัสลูกค้า: C0001')}/>
   <div className="draft-source-actions"><button type="button" disabled={busy||!source.trim()&&!lookup.trim()} onClick={analyze}>{busy?t('กำลังตรวจสอบ…'):t('ตรวจสอบและจัดข้อมูล')}</button>{ready&&<button type="button" className="secondary" onClick={()=>setResultVisible(true)}>{t("ดูผลลัพธ์ล่าสุด")}</button>}<span>{t("ข้อมูลที่อ่านไม่ได้จะเว้นไว้ให้เติม")}</span></div>
  </section>
  {ready&&<dialog ref={resultDialog} className="draft-result-dialog" aria-labelledby="draft-result-title" onClose={()=>setResultVisible(false)} onClick={e=>{if(e.target!==e.currentTarget)return;const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)resultDialog.current?.close();}}>
   <header className="draft-result-header"><div><h2 id="draft-result-title">{formatIssues.length?t('ข้อมูลติดต่อยังไม่ครบ'):t('ผลลัพธ์แยกคอลัมน์')}</h2><p>{formatIssues.length?t('แก้เบอร์โทรหรือรหัสไปรษณีย์ก่อนดำเนินการ'):issues.length?t('ตรวจและเติมช่องที่ยังขาด'):directOrders?t('ข้อมูลครบ พร้อมบันทึกออเดอร์'):t('ข้อมูลครบ พร้อมคัดลอกส่งงาน')}</p></div><button type="button" className="secondary" aria-label={t("ปิดผลลัพธ์")} onClick={()=>resultDialog.current?.close()}>{t("ปิด ×")}</button></header>
   <section className="draft-column-output" id="draft-preview">
   <header>{directOrders?<label>{t("ทีม / บ้าน")}<select aria-label={t("ทีม / บ้าน")} value={team} disabled={directSaving||!!directSaved} onChange={e=>setTeam(e.target.value)}><option value="">{t("เลือกทีม")}</option>{directOrders.groups.map(group=><option key={group.id} value={group.id}>{group.name||t('กลุ่มยังไม่ตั้งชื่อ')}</option>)}</select></label>:<label>{t("แบบฟอร์ม")}<select value={templateId} onChange={e=>{setTemplateId(e.target.value);setCopied(false);}}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}</header>
   {directOrders&&<datalist id="direct-order-sellers">{directOrders.sellers.map(item=><option key={item.username} value={item.username}/>)}</datalist>}
   {notice&&<p className="draft-notice" role="status">{t(notice)}</p>}
   {customerPromptReady&&identityBusy&&<p role="status">{t("กำลังค้นหาลูกค้าจากเบอร์โทร…")}</p>}
   {customerPromptReady&&identityStatus==='error'&&<p role="alert">{t(identityError)} {t(" กรุณากดตรวจสอบและจัดข้อมูลอีกครั้ง ยังไม่สามารถสร้างลูกค้าได้จนกว่าจะค้นหาสำเร็จ")}</p>}
   {draft.customerCode&&!lookupIssue?<CustomerLineLink key={draft.customerCode} code={draft.customerCode} active={resultVisible}/>:<section className="draft-line-link" aria-label={t("ผูก LINE ของลูกค้า")}>
    <div className="draft-line-link-heading"><strong>{t("ผูก LINE ของลูกค้า")}</strong><span role="status">{identityBusy?t('กำลังค้นหาจากเบอร์โทร…'):t('เลือกลูกค้าก่อนสร้างลิงก์')}</span></div>
    <p>{t("ใช้เบอร์โทรค้นหาสมาชิกเดิม หรือสร้างสมาชิกก่อนคัดลอกลิงก์ผูก LINE")}</p>
    <button type="button" disabled={identityBusy} onClick={openCustomer}>{t("เลือกหรือสร้างลูกค้า")}</button>
   </section>}
   {formatIssues.length>0&&<div className="draft-format-alert" role="alert"><strong>{t("กรุณาตรวจสอบข้อมูล")}</strong><ul>{formatIssues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>}
   {addressComparison&&<fieldset className="draft-address-compare"><legend>{t("ที่อยู่ในข้อความต่างจากข้อมูลเดิม")}</legend><p>{t("ลูกค้าอาจส่งไปที่อยู่ใหม่ โปรดเลือกที่อยู่สำหรับออเดอร์นี้")}</p><div>{([['incoming','ใช้ที่อยู่จากข้อความลูกค้า',addressComparison.incoming],['stored','ใช้ที่อยู่ที่บันทึกไว้',addressComparison.stored]] as const).map(([choice,label,address])=><label key={choice} className={addressChoice===choice?'selected':''}><span><input type="radio" name="address-choice" checked={addressChoice===choice} onChange={()=>{setAddressChoice(choice);setDraft(d=>({...d,address}));setCopied(false);}}/>{label}</span><pre>{address}</pre></label>)}</div>{addressChoice==='custom'&&<p>{t("ใช้ที่อยู่ที่คุณแก้ไขในคอลัมน์ด้านล่าง")}</p>}<small>{t("การเลือกนี้ใช้เฉพาะข้อความส่งงาน ไม่เปลี่ยนที่อยู่เดิมในระบบ")}</small></fieldset>}
   <table><thead><tr><th>{t("หัวข้อ")}</th><th>{t("ข้อมูลสำหรับส่งงาน ")}<span>{t("แก้ไขได้")}</span></th></tr></thead><tbody>{columns.map(key=><tr key={key} className={!draft[key]&&key!=='points'?'draft-missing':''}><th scope="row">{t(draftFields[key])}{key==='customerCode'&&<small>{t("จำเป็น")}</small>}</th><td>{key==='payment'?<select aria-label={t(draftFields[key])} disabled={directSaving||!!directSaved} value={draft[key]} onChange={e=>field(key,e.target.value)}><option value="">{t("เลือกวิธีชำระเงิน")}</option><option>COD</option><option>{t("โอน")}</option>{!directOrders&&<option>{t("เคลม")}</option>}</select>:key==='address'||key==='products'?<textarea aria-label={t(draftFields[key])} disabled={directSaving||!!directSaved} rows={key==='address'?3:2} value={draft[key]} onChange={e=>field(key,e.target.value)} maxLength={2000}/>:<input aria-label={t(draftFields[key])} disabled={directSaving||!!directSaved} list={directOrders&&key==='seller'?'direct-order-sellers':undefined} readOnly={key==='points'||key==='customerCode'||key==='seller'&&directOrders?.lockSeller} placeholder={key==='points'?t('รอดึงข้อมูลลูกค้า'):undefined} type={key==='amount'?'number':key==='phone'?'tel':'text'} inputMode={key==='amount'?'decimal':undefined} min={key==='amount'?'0':undefined} step={key==='amount'?'0.01':undefined} value={draft[key]} onChange={e=>field(key,e.target.value)} maxLength={key==='amount'?undefined:200}/>}</td></tr>)}</tbody></table>
   {directOrders&&draft.payment==='โอน'&&<div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginTop:16}}>
    <label style={{flex:1,minWidth:180}}>{t("แนบรูปหลักฐานการโอนเงิน")}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={directSaving||!!directSaved} onChange={event=>readSlip(event.target.files?.[0])}/><small>{t("JPG, PNG หรือ WebP ไม่เกิน 2 MB")}</small></label>
    {slip&&<img src={slip} alt={t("ตัวอย่างหลักฐานการโอนเงิน")} style={{width:90,height:90,objectFit:'contain',border:'1px solid #dce7df',borderRadius:8}}/>}
    {slipName&&<small>{slipName}</small>}
   </div>}
   {issues.length>0&&<p className="draft-validation">{issues.join(' · ')}</p>}
   <PopupDetails className="draft-copy-preview" summary={<> {directOrders?t('ดูข้อมูลออเดอร์ที่แยกได้'):t('ดูข้อความที่จะคัดลอก')} </>}><pre>{preview}</pre></PopupDetails>
   <p className="small muted">{directOrders?t('ตรวจชื่อ เบอร์ ที่อยู่ สินค้า และยอดเงินก่อนกดบันทึกออเดอร์'):t('คัดลอกแล้วนำไปวางในกลุ่มส่งงาน ยังไม่บันทึกเป็นออเดอร์จนกว่าจะส่งให้บอทตามปกติ')}</p>
  </section><footer className="draft-result-footer"><span role="status">{dataIssues.length?dataIssues[0]:identityBusy?t('กำลังค้นหาลูกค้า…'):!draft.customerCode?identityStatus==='error'?t('ค้นหาไม่สำเร็จ กดสร้างรหัสลูกค้าเพื่อลองใหม่'):t('ยังไม่มีรหัสลูกค้า กดสร้างรหัสลูกค้า'):directOrders?t('พร้อมบันทึกออเดอร์'):t('พร้อมนำไปวางในกลุ่มส่งงาน')}</span><div className="draft-result-actions"><button type="button" className="secondary" disabled={!!draft.customerCode&&!lookupIssue||identityBusy} title={draft.customerCode&&!lookupIssue?t('มีรหัสลูกค้าแล้ว'):undefined} onClick={openCustomer}>{t("สร้างรหัสลูกค้า")}</button><button type="button" disabled={issues.length>0||identityBusy||!!directOrders&&(!team||directSaving||readingSlip||!!directSaved||draft.payment==='โอน'&&!slip)} onClick={directOrders?submitDirectOrder:copy}>{directOrders?(directSaving?t('กำลังบันทึก…'):directSaved?t('บันทึกแล้ว'):t('บันทึกออเดอร์')):(copied?t('คัดลอกแล้ว ✓'):t('คัดลอกข้อความ'))}</button>{directSaved&&<Link className="button" href={(directOrders?.detailBase??'/admin/orders/list/')+directSaved.orderId}>{t("เปิดออเดอร์")}</Link>}</div></footer></dialog>}
  {ready&&<dialog ref={customerDialog} className="draft-customer-dialog" aria-labelledby="draft-customer-title" onCancel={e=>{e.preventDefault();if(!identityBusy)dismissCustomer();}}>
   <header><h2 id="draft-customer-title">{customerOptions.length?t('เลือกลูกค้าที่ตรงกัน'):t('สร้างรหัสลูกค้าใหม่หรือไม่?')}</h2><button type="button" className="secondary" disabled={identityBusy} aria-label={t("ปิดคำถามรหัสลูกค้า")} onClick={dismissCustomer}>{t("ปิด ×")}</button></header>
   {identityError&&<p className="draft-notice" role="alert">{t(identityError)}</p>}
<section className="draft-customer-resolution" id="customer-code-prompt"><h3>{t("ยังไม่มีรหัสลูกค้า ต้องเลือกหรือสร้างก่อน")}{directOrders?t('บันทึกออเดอร์'):t('คัดลอก')}</h3><p>{identityStatus==='found'?t('พบข้อมูลที่ใช้เบอร์นี้ ตรวจชื่อแล้วเลือกรหัสของลูกค้า'):identityStatus==='none'?t('ไม่พบลูกค้าจากเบอร์นี้ สามารถสร้างรหัสใหม่ได้'):identityStatus==='dismissed'?t('ต้องมีรหัสลูกค้าก่อนคัดลอกข้อความ'):t('ค้นหาจากเบอร์โทรก่อน เพื่อป้องกันสร้างลูกค้าซ้ำ')}</p>
    {(identityStatus==='found'&&customerOptions.length>0)&&<div className="draft-customer-options">{customerOptions.map(c=><div key={c.customerCode}><span><strong>{c.customerCode}</strong> · {c.recipient||t('ยังไม่ระบุชื่อ')}<small>{c.phone}</small></span><button type="button" className="secondary" disabled={identityBusy} onClick={()=>useCustomer(c.customerCode)}>{t("ใช้รหัสนี้")}</button></div>)}</div>}
    <div className="draft-customer-actions">{(identityStatus==='none'||identityStatus==='dismissed'&&!customerOptions.length)&&<button type="button" disabled={identityBusy||!draft.recipient||!draft.phone} onClick={createCustomer}>{identityBusy?(directOrders?t('กำลังสร้าง…'):t('กำลังสร้างและคัดลอก…')):directOrders?t('สร้างลูกค้าใหม่'):t('คัดลอกและสร้างลูกค้าใหม่')}</button>}<button type="button" className="secondary" disabled={identityBusy} onClick={dismissCustomer}>{t("กลับไปตรวจข้อมูล")}</button></div><small>{directOrders?t('สร้างรหัสลูกค้าก่อน แล้วกลับมาตรวจและบันทึกออเดอร์'):t('สร้างรหัสในระบบแล้วคัดลอกข้อความพร้อมรหัสให้ทันที ยังไม่สร้างออเดอร์')}</small>
   </section>
  </dialog>}
  {creationResult&&<dialog ref={successDialog} className="draft-customer-dialog draft-success-dialog" aria-labelledby="draft-success-title" onCancel={e=>{e.preventDefault();setCreationResult(null);}}>
   <div className="draft-success-mark" aria-hidden="true">✓</div><h2 id="draft-success-title">{t("สร้างลูกค้าสำเร็จ")}</h2>
   <p>{t("รหัสลูกค้า ")}<strong>{creationResult.code}</strong></p><p>{creationResult.copied?t('คัดลอกข้อความพร้อมรหัสลูกค้าแล้ว'):t('บันทึกลูกค้าแล้ว แต่ยังคัดลอกข้อความไม่สำเร็จ กรุณาลองอีกครั้ง')}</p>
   {!creationResult.copied&&<button type="button" onClick={async()=>{const copied=await writeClipboard();setCreationResult(result=>result?{...result,copied}:null);}}>{t("คัดลอกข้อความอีกครั้ง")}</button>}
   <button type="button" className={creationResult.copied?'':'secondary'} onClick={()=>setCreationResult(null)}>{t("ตกลง")}</button>
  </dialog>}
  {canManage&&<PopupDetails className="draft-template-settings" summary={<> {t(" เพิ่มแบบฟอร์มส่งงาน ")}</>}><p>{t("ใช้ชื่อช่องตามที่แสดง รหัสผู้ขายเป็นบรรทัดแรก และ Green Coin อยู่ใต้รหัสลูกค้าเป็นบรรทัดท้าย")}</p><form onSubmit={async e=>{e.preventDefault();setSaving(true);try{const response=await fetch('/api/admin/order-templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:templateName,body:templateBody})});const data=await response.json();if(!response.ok){setNotice(data.error);return;}setTemplates(t=>[...t,data.template]);setTemplateId(data.template.id);setTemplateName('');setNotice('บันทึกแบบฟอร์มแล้ว');}catch{setNotice('บันทึกแบบฟอร์มไม่ได้');}finally{setSaving(false);}}}><label>{t("ชื่อแบบฟอร์ม")}<input value={templateName} onChange={e=>setTemplateName(e.target.value)} required maxLength={80}/></label><label>{t("ข้อความแบบฟอร์ม")}<textarea rows={10} value={templateBody} onChange={e=>setTemplateBody(e.target.value)} maxLength={4000}/></label><button disabled={saving}>{saving?t('กำลังบันทึก…'):t('บันทึกแบบฟอร์มใหม่')}</button></form></PopupDetails>}
 </div>;
}
