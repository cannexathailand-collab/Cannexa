'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useStockDeleteQueue} from './stock-delete-provider';
import {OaJobList} from './oa-job-list';
import {canConfirmPreview,confirmPreview,editCardDetails,replacePreviewResearch,previewSummary,type CardPreviewProduct,type CardPreviewResearch} from '@/lib/line-card-preview-state';
type Draft={account:string|null;aiConfigured:boolean;sets:{title:string;products:CardPreviewProduct[]}[];delivery:{savedToLineOA:boolean;requiresLocalRunner:boolean}};
export function StockLineCardDraft(){
 const router=useRouter(),settingsSaved=useRef(false);
 const selection=useStockDeleteQueue(),dialog=useRef<HTMLDialogElement>(null),generation=useRef(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState<Draft|null>(null);
 const [oaAccount,setOaAccount]=useState(''),[researchContext,setResearchContext]=useState(''),[researching,setResearching]=useState<string|null>(null);
 const [using,setUsing]=useState(false),[usedMessage,setUsedMessage]=useState(''),[confirming,setConfirming]=useState<string|null>(null);
 const useRequestKey=useRef<string|null>(null);
 const signature=[...(selection?.selected??[])].sort().join('\0');
 useEffect(()=>{generation.current++;setDraft(null);setBusy(false);setResearching(null);setUsedMessage('');useRequestKey.current=null;},[signature,oaAccount,researchContext]);
 function updateProduct(code:string,update:(product:CardPreviewProduct)=>CardPreviewProduct){
  setDraft(current=>current?{...current,sets:current.sets.map(set=>({...set,products:set.products.map(product=>product.code===code?update(product):product)}))}:current);
 }
 async function confirmProduct(product:CardPreviewProduct){
  if(!canConfirmPreview(product)||confirming)return;
  setConfirming(product.code);setError('');
  try{
   const response=await fetch('/api/admin/stock/description',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:product.code,name:product.name??'',text:product.description??'',linkUrl:product.linkUrl??'',version:product.settingsVersion??''})});
   const saved=await response.json();if(!response.ok)throw Error(saved.error??'ยังบันทึกข้อมูลการ์ดไม่ได้');
   settingsSaved.current=true;
   updateProduct(product.code,current=>confirmPreview({...current,description:saved.text,linkUrl:saved.linkUrl,settingsVersion:saved.version}));
  }catch(failure){setError(failure instanceof Error?failure.message:'ยังบันทึกข้อมูลการ์ดไม่ได้');}
  finally{setConfirming(null);}
 }
 async function research(code:string){
  const response=await fetch('/api/admin/stock/line-card-research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,researchContext})});
  const result:CardPreviewResearch&{error?:string}=await response.json();
  if(!response.ok)throw Error(result.error??'ค้นข้อมูลไม่สำเร็จ');
  return result;
 }
 async function retryResearch(code:string){
  const token=generation.current;setResearching(code);useRequestKey.current=null;setUsedMessage('');
  updateProduct(code,product=>({...product,confirmed:false,previewToken:undefined,researchError:undefined}));
  try{const result=await research(code);if(token===generation.current)updateProduct(code,product=>replacePreviewResearch(product,result));}
  catch(failure){if(token===generation.current)updateProduct(code,product=>({...product,confirmed:false,researchError:failure instanceof Error?failure.message:'ค้นข้อมูลไม่สำเร็จ'}));}
  finally{if(token===generation.current)setResearching(null);}
 }
 async function usePreview(){
  if(!draft)return;
  const products=draft.sets.flatMap(set=>set.products);
  if(!products.length||products.some(product=>!product.confirmed||!canConfirmPreview(product)||product.images.some(image=>!image.url)))return;
  setUsing(true);setError('');
  try{
   useRequestKey.current??=crypto.randomUUID();
   const response=await fetch('/api/admin/stock/line-oa-jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes:products.map(product=>product.code),account:oaAccount,researchContext,requestKey:useRequestKey.current,prepared:products.map(product=>({code:product.code,token:product.previewToken,confirmed:true}))})});
   const result=await response.json();if(!response.ok)throw Error(result.error??'ยังส่งข้อมูลชุดนี้ไม่ได้');
   setUsedMessage('รับข้อมูลชุดที่ยืนยันแล้วเข้าคิว โดยไม่ค้นข้อมูลใหม่ · ดูสถานะงานด้านล่าง');dialog.current?.close();
  }catch(failure){setError(failure instanceof Error?failure.message:'ยังส่งข้อมูลชุดนี้ไม่ได้');}
  finally{setUsing(false);}
 }
 const prepared=draft&&!busy?previewSummary(draft.sets.flatMap(set=>set.products)):'';
 if(!selection?.enabled)return null;
 return <><OaJobList oaAccount={oaAccount} setOaAccount={setOaAccount} researchContext={researchContext} setResearchContext={setResearchContext}/>
 <div className="actions" style={{marginBottom:16}}><button type="button" disabled={busy||using||!!researching||selection.busy||!selection.selected.size} onClick={async()=>{
  const token=++generation.current;setBusy(true);setError('');setDraft(null);setUsedMessage('');useRequestKey.current=null;
  try{
   const response=await fetch('/api/admin/stock/line-card-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes:[...selection.selected]})});
   const data:Draft&{error?:string}=await response.json();if(!response.ok)throw Error(data.error);
   if(token!==generation.current)return;
   data.account=oaAccount||data.account;setDraft(data);dialog.current?.showModal();
   if(data.aiConfigured)for(const product of data.sets.flatMap(set=>set.products)){
    setResearching(product.code);
    try{const result=await research(product.code);if(token!==generation.current)return;updateProduct(product.code,current=>replacePreviewResearch(current,result));}
    catch(failure){if(token!==generation.current)return;updateProduct(product.code,current=>({...current,researchError:failure instanceof Error?failure.message:'ค้นข้อมูลไม่สำเร็จ',confirmed:false}));}
   }
  }catch(failure){if(token===generation.current)setError(failure instanceof Error?failure.message:'เตรียมข้อมูลไม่ได้');}
  finally{if(token===generation.current){setBusy(false);setResearching(null);}}
 }}>{busy?'กำลังเตรียมข้อมูล…':'สร้างข้อความและการ์ด LINE OA'}</button></div>
 {prepared&&<p role="status" className="notice">{prepared}</p>}{usedMessage&&<p role="status" className="notice">{usedMessage}</p>}{error&&<p role="alert" className="notice">{error}</p>}
 <dialog ref={dialog} className="stock-modal" aria-label="ตัวอย่างชุดการ์ด LINE OA" onClose={()=>{if(settingsSaved.current){settingsSaved.current=false;router.refresh();}}}><h2>ตัวอย่างชุดการ์ด LINE OA</h2><p>บัญชีปลายทาง: {draft?.account??'ยังไม่ได้เลือก LINE OA'}</p>
 <p className="notice">กรอกคำอธิบายและลิงก์แยกตามสินค้า ระบบจะจำไว้เมื่อยืนยันข้อมูล ตรวจและยืนยันแต่ละรายการ แล้วกดใช้ข้อมูลชุดนี้เพื่อบันทึกข้อความและการ์ดใน LINE OA โดยไม่ค้นใหม่</p>{prepared&&<p role="status">{prepared}</p>}
 {!draft?.aiConfigured&&<p>ยังไม่ได้เชื่อม OpenAI กรุณาไปที่หมวดการเชื่อมต่อ</p>}
 {draft?.sets.map(set=><section key={set.title}><h3>{set.title}</h3>{set.products.map(product=><article key={product.code} className="card" aria-label={'ตัวอย่าง '+product.code}>
  <strong>{product.code} · {product.name??'ยังไม่มีชื่อ'}</strong>
  <div className="actions">{product.images.map(image=>image.url?<img key={image.slot} src={image.url} alt={'รูป '+image.slot+' '+product.code} width={90} height={90} style={{objectFit:'contain'}}/>:<span key={image.slot} className="muted">ยังไม่มีรูป {image.slot}</span>)}</div>
  <p className="small">Show details → {product.keyword}</p>
  <label>คำอธิบายการ์ด {product.code}<textarea rows={2} maxLength={60} value={product.description??''} disabled={using||!!confirming} onChange={event=>updateProduct(product.code,current=>editCardDetails(current,{description:event.target.value}))}/></label>
  <p className="small">{product.description?.length??0}/60 ตัวอักษร</p>
  <label>ลิงก์การ์ด {product.code}<input type="url" placeholder="https://" maxLength={2048} value={product.linkUrl??''} disabled={using||!!confirming} onChange={event=>updateProduct(product.code,current=>editCardDetails(current,{linkUrl:event.target.value}))}/></label>
  <p className="small">เก็บแยกตามรหัสเมื่อยืนยันข้อมูล หากเว้นลิงก์ว่างจะเปิดหน้าบัญชีลูกค้า</p>
  {product.research&&<><p style={{whiteSpace:'pre-wrap'}}>{product.research.text}</p>
   {product.research.sources.map(source=><p key={source}><a href={source} target="_blank" rel="noreferrer">เว็บไซต์อ้างอิง: {new URL(source).hostname}</a>{product.research?.sourceStatus==='suggested'&&<span> · รอคุณตรวจและยืนยัน</span>}</p>)}
   {!product.confirmed&&product.research.needsReview&&<p className="notice">{product.research.reviewReason??'พบข้อมูลแล้ว กรุณาตรวจว่าตรงกับสินค้าก่อนยืนยัน'}</p>}
   {!product.research.sources.length&&<p className="notice">ยังไม่มีแหล่งอ้างอิงที่ตรวจสอบได้ กรุณาค้นหาข้อมูลใหม่ก่อนยืนยัน</p>}
  </>}
  {product.researchError&&<p role="alert" className="notice">{product.researchError}</p>}
  {product.confirmed&&<p role="status" className="notice">ยืนยันข้อมูลตัวอย่างแล้ว</p>}
  {researching===product.code&&<p role="status">กำลังค้นข้อมูล {product.code}…</p>}
  {busy&&researching!==product.code&&!product.research&&!product.researchError&&<p className="small">รอค้นข้อมูล {product.code}</p>}
  <div className="actions"><button type="button" disabled={busy||using||!!researching||!!confirming||product.confirmed||!canConfirmPreview(product)} onClick={()=>void confirmProduct(product)}>{confirming===product.code?'กำลังบันทึก…':product.confirmed?'ยืนยันข้อมูลแล้ว':'ยืนยันข้อมูล'}</button>
   <button type="button" className="secondary" disabled={busy||using||!!researching||!!confirming||!draft.aiConfigured} onClick={()=>void retryResearch(product.code)}>ค้นหาข้อมูลใหม่</button></div>
 </article>)}</section>)}
 {busy&&<p role="status">{researching?`กำลังค้นข้อมูล ${researching}…`:'กำลังเตรียมรายการ…'}</p>}{error&&<p role="alert" className="notice">{error}</p>}
 <div className="actions"><button type="button" disabled={busy||using||!!researching||!!confirming||!oaAccount||!!usedMessage||!draft?.sets.length||draft.sets.some(set=>set.products.some(product=>!product.confirmed||!canConfirmPreview(product)||product.images.some(image=>!image.url)))} onClick={()=>void usePreview()}>{using?'กำลังรับข้อมูล…':'ใช้ข้อมูลชุดนี้สร้างใน LINE OA'}</button>
 <button type="button" className="secondary" disabled={busy||using||!!researching||!!confirming} onClick={()=>dialog.current?.close()}>ปิด</button></div></dialog></>;
}
