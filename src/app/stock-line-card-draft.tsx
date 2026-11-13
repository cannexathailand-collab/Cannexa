'use client';
import {useEffect,useRef,useState} from 'react';
import {useStockDeleteQueue} from './stock-delete-provider';
import {OaJobList} from './oa-job-list';
import {canConfirmPreview,confirmPreview,replacePreviewResearch,previewSummary,type CardPreviewProduct,type CardPreviewResearch} from '@/lib/line-card-preview-state';
type Draft={account:string|null;aiConfigured:boolean;sets:{title:string;products:CardPreviewProduct[]}[];delivery:{savedToLineOA:boolean;requiresLocalRunner:boolean}};
export function StockLineCardDraft(){
 const selection=useStockDeleteQueue(),dialog=useRef<HTMLDialogElement>(null),generation=useRef(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState<Draft|null>(null);
 const [oaAccount,setOaAccount]=useState(''),[researchContext,setResearchContext]=useState(''),[researching,setResearching]=useState<string|null>(null);
 const signature=[...(selection?.selected??[])].sort().join('\0');
 useEffect(()=>{generation.current++;setDraft(null);setBusy(false);setResearching(null);},[signature,oaAccount,researchContext]);
 function updateProduct(code:string,update:(product:CardPreviewProduct)=>CardPreviewProduct){
  setDraft(current=>current?{...current,sets:current.sets.map(set=>({...set,products:set.products.map(product=>product.code===code?update(product):product)}))}:current);
 }
 async function research(code:string){
  const response=await fetch('/api/admin/stock/line-card-research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,researchContext})});
  const result:CardPreviewResearch&{error?:string}=await response.json();
  if(!response.ok)throw Error(result.error??'ค้นข้อมูลไม่สำเร็จ');
  return result;
 }
 async function retryResearch(code:string){
  const token=generation.current;setResearching(code);
  updateProduct(code,product=>({...product,confirmed:false,researchError:undefined}));
  try{const result=await research(code);if(token===generation.current)updateProduct(code,product=>replacePreviewResearch(product,result));}
  catch(failure){if(token===generation.current)updateProduct(code,product=>({...product,confirmed:false,researchError:failure instanceof Error?failure.message:'ค้นข้อมูลไม่สำเร็จ'}));}
  finally{if(token===generation.current)setResearching(null);}
 }
 const prepared=draft&&!busy?previewSummary(draft.sets.flatMap(set=>set.products)):'';
 if(!selection?.enabled)return null;
 return <><OaJobList oaAccount={oaAccount} setOaAccount={setOaAccount} researchContext={researchContext} setResearchContext={setResearchContext}/>
 <div className="actions" style={{marginBottom:16}}><button type="button" disabled={busy||!!researching||selection.busy||!selection.selected.size} onClick={async()=>{
  const token=++generation.current;setBusy(true);setError('');setDraft(null);
  try{
   const response=await fetch('/api/admin/stock/line-card-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes:[...selection.selected]})});
   const data:Draft&{error?:string}=await response.json();if(!response.ok)throw Error(data.error);
   if(token!==generation.current)return;
   data.account=oaAccount||data.account;setDraft(data);dialog.current?.showModal();
   if(data.aiConfigured)for(const product of data.sets.flatMap(set=>set.products)){
    try{const result=await research(product.code);if(token!==generation.current)return;updateProduct(product.code,current=>replacePreviewResearch(current,result));}
    catch(failure){if(token!==generation.current)return;updateProduct(product.code,current=>({...current,researchError:failure instanceof Error?failure.message:'ค้นข้อมูลไม่สำเร็จ',confirmed:false}));}
   }
  }catch(failure){if(token===generation.current)setError(failure instanceof Error?failure.message:'เตรียมข้อมูลไม่ได้');}
  finally{if(token===generation.current)setBusy(false);}
 }}>{busy?'กำลังเตรียมข้อมูล…':'ดูตัวอย่างการ์ด (ไม่บันทึก)'}</button></div>
 {prepared&&<p role="status" className="notice">{prepared}</p>}{error&&<p role="alert" className="notice">{error}</p>}
 <dialog ref={dialog} className="stock-modal" aria-label="ตัวอย่างชุดการ์ด LINE OA"><h2>ตัวอย่างชุดการ์ด LINE OA</h2><p>บัญชีปลายทาง: {draft?.account??'ยังไม่ได้เลือก LINE OA'}</p>
 <p className="notice">การยืนยันนี้เป็นการตรวจข้อมูลตัวอย่าง ยังไม่ได้บันทึกใน LINE OA ขั้นสร้างงานยังค้นข้อมูลใหม่</p>{prepared&&<p role="status">{prepared}</p>}
 {!draft?.aiConfigured&&<p>ยังไม่ได้เชื่อม OpenAI กรุณาไปที่หมวดการเชื่อมต่อ</p>}
 {draft?.sets.map(set=><section key={set.title}><h3>{set.title}</h3>{set.products.map(product=><article key={product.code} className="card" aria-label={'ตัวอย่าง '+product.code}>
  <strong>{product.code} · {product.name??'ยังไม่มีชื่อ'}</strong>
  <div className="actions">{product.images.map(image=>image.url?<img key={image.slot} src={image.url} alt={'รูป '+image.slot+' '+product.code} width={90} height={90} style={{objectFit:'contain'}}/>:<span key={image.slot} className="muted">ยังไม่มีรูป {image.slot}</span>)}</div>
  <p className="small">Show details → {product.keyword}</p>
  {product.research&&<><p style={{whiteSpace:'pre-wrap'}}>{product.research.text}</p>
   {product.research.sources.map(source=><p key={source}><a href={source} target="_blank" rel="noreferrer">แหล่งอ้างอิง: {new URL(source).hostname}</a></p>)}
   {!product.confirmed&&product.research.needsReview&&<p className="notice">{product.research.reviewReason??'พบข้อมูลแล้ว กรุณาตรวจว่าตรงกับสินค้าก่อนยืนยัน'}</p>}
   {!product.research.sources.length&&<p className="notice">ยังไม่มีแหล่งอ้างอิงที่ตรวจสอบได้ กรุณาค้นหาข้อมูลใหม่ก่อนยืนยัน</p>}
  </>}
  {product.researchError&&<p role="alert" className="notice">{product.researchError}</p>}
  {product.confirmed&&<p role="status" className="notice">ยืนยันข้อมูลตัวอย่างแล้ว</p>}
  {researching===product.code&&<p role="status">กำลังค้นหาข้อมูลใหม่…</p>}
  <div className="actions"><button type="button" disabled={busy||!!researching||product.confirmed||!canConfirmPreview(product)} onClick={()=>updateProduct(product.code,confirmPreview)}>{product.confirmed?'ยืนยันข้อมูลแล้ว':'ยืนยันข้อมูล'}</button>
   <button type="button" className="secondary" disabled={busy||!!researching||!draft.aiConfigured} onClick={()=>void retryResearch(product.code)}>ค้นหาข้อมูลใหม่</button></div>
 </article>)}</section>)}
 {busy&&<p role="status">กำลังค้นและเตรียมข้อมูล…</p>}<button type="button" className="secondary" disabled={busy||!!researching} onClick={()=>dialog.current?.close()}>ปิด</button></dialog></>;
}
