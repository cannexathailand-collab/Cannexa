'use client';
import {useEffect,useRef,useState} from 'react';
import {useStockDeleteQueue} from './stock-delete-provider';
import {OaJobList} from './oa-job-list';
type Product={code:string;name:string|null;images:{slot:number;url:string|null}[];keyword:string;missingImageSlots:number[];research?:{text:string;needsReview:boolean};researchError?:string};
type Draft={account:string|null;aiConfigured:boolean;sets:{title:string;products:Product[]}[];delivery:{savedToLineOA:boolean;requiresLocalRunner:boolean}};
export function StockLineCardDraft(){
 const selection=useStockDeleteQueue(),dialog=useRef<HTMLDialogElement>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[draft,setDraft]=useState<Draft|null>(null);
 const [oaAccount,setOaAccount]=useState(''),[prepared,setPrepared]=useState('');
 const signature=[...(selection?.selected??[])].sort().join('\0');
 useEffect(()=>{setPrepared('');},[signature,oaAccount]);
 if(!selection?.enabled)return null;
 return <><OaJobList oaAccount={oaAccount} setOaAccount={setOaAccount}/><div className="actions" style={{marginBottom:16}}><button type="button" disabled={busy||selection.busy||!selection.selected.size} onClick={async()=>{
  setBusy(true);setError('');setPrepared('');try{
   const r=await fetch('/api/admin/stock/line-card-draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes:[...selection.selected]})});const data:Draft&{error?:string}=await r.json();if(!r.ok)throw Error(data.error);data.account=oaAccount||data.account;setDraft(data);dialog.current?.showModal();
   if(data.aiConfigured)for(const product of data.sets.flatMap(set=>set.products)){
    try{const result=await fetch('/api/admin/stock/line-card-research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:product.code})});const research=await result.json();if(!result.ok)throw Error(research.error);product.research=research;}
    catch(failure){product.researchError=failure instanceof Error?failure.message:'ค้นข้อมูลไม่สำเร็จ';}
    setDraft({...data,sets:data.sets.map(set=>({...set,products:[...set.products]}))});
   }
   const products=data.sets.flatMap(set=>set.products),needsReview=products.some(product=>product.missingImageSlots.length||product.researchError||product.research?.needsReview);
   setPrepared((needsReview?'เตรียมตัวอย่างแล้ว กรุณาตรวจข้อมูลที่แจ้งเตือน':'เตรียมเรียบร้อยแล้ว')+' · '+products.length+' รายการ');
  }catch(e){setError(e instanceof Error?e.message:'เตรียมข้อมูลไม่ได้');}finally{setBusy(false);}
 }}>{busy?'กำลังเตรียมข้อมูล…':'ดูตัวอย่างการ์ด (ไม่บันทึก)'}</button></div>{prepared&&<p role="status" className="notice">{prepared} · กดสร้างการ์ดและข้อความตอบกลับเพื่อบันทึกใน OA</p>}{error&&<p role="alert" className="notice">{error}</p>}
 <dialog ref={dialog} className="stock-modal" aria-label="ตัวอย่างชุดการ์ด LINE OA"><h2>ตัวอย่างชุดการ์ด LINE OA</h2><p>บัญชีปลายทาง: {draft?.account??'ยังไม่ได้เลือก LINE OA'}</p><p className="notice">นี่คือตัวอย่างข้อมูล ยังไม่ได้บันทึกใน LINE OA เมื่อพร้อมให้ปิดหน้าต่างแล้วกดสร้างการ์ดและข้อความตอบกลับ</p>{prepared&&<p role="status">{prepared}</p>}
 {!draft?.aiConfigured&&<p>ยังไม่ได้เชื่อม OpenAI กรุณาไปที่หมวดการเชื่อมต่อ</p>}
 {draft?.sets.map(set=><section key={set.title}><h3>{set.title}</h3>{set.products.map(p=><article key={p.code} className="card"><strong>{p.code} · {p.name??'ยังไม่มีชื่อ'}</strong><div className="actions">{p.images.map(image=>image.url?<img key={image.slot} src={image.url} alt={'รูป '+image.slot+' '+p.code} width={90} height={90} style={{objectFit:'contain'}}/>:<span key={image.slot} className="muted">ยังไม่มีรูป {image.slot}</span>)}</div><p className="small">Show details → {p.keyword}</p>{p.research&&<><p style={{whiteSpace:'pre-wrap'}}>{p.research.text}</p>{p.research.needsReview&&<p className="notice">ข้อมูลต้องตรวจสอบก่อนบันทึก</p>}</>}{p.researchError&&<p className="notice">{p.researchError}</p>}</article>)}</section>)}
 {busy&&<p role="status">กำลังค้นและเตรียมข้อมูล…</p>}<button type="button" className="secondary" disabled={busy} onClick={()=>dialog.current?.close()}>ปิด</button></dialog></>;
}
