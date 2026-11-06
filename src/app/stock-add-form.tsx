'use client';
import {useState,useRef} from 'react';
import {useRouter} from 'next/navigation';
import {matchStockProduct,suggestStockProducts,type StockFormProduct} from '@/lib/stock-form-match';
const amount=(n:number|null)=>n===null?'ยังไม่ระบุ':n.toLocaleString('th-TH',{maximumFractionDigits:3});
export function StockAddForm({requestKey:initialKey,enabled,catalog}:{requestKey:string;enabled:boolean;catalog:StockFormProduct[]}){
 const dialog=useRef<HTMLDialogElement>(null),formRef=useRef<HTMLFormElement>(null),codeRef=useRef<HTMLInputElement>(null);
 const router=useRouter(),[requestKey,setRequestKey]=useState(initialKey),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<StockFormProduct|null>(null),[focused,setFocused]=useState(false),[active,setActive]=useState(-1);
 const suggestions=suggestStockProducts(query,catalog),expanded=focused&&suggestions.length>0;
 function chooseCode(code:string,close=false){const found=matchStockProduct(code,catalog);setQuery(code);setSelected(found);setActive(-1);setFocused(!close);const name=formRef.current?.elements.namedItem('name') as HTMLInputElement|null,cost=formRef.current?.elements.namedItem('cost') as HTMLInputElement|null;if(found){if(name)name.value=found.name??'';if(cost)cost.value=found.costSatang===null?'':String(found.costSatang/100);}else if(selected){if(name)name.value='';if(cost)cost.value='';}}
 return <><button className="sales-export" type="button" onClick={()=>{dialog.current?.showModal();codeRef.current?.focus();}}>+ รับสินค้า / เพิ่มสินค้า</button>
 <dialog ref={dialog} aria-labelledby="stock-add-title" onCancel={event=>{if(busy)event.preventDefault();}} onClose={()=>setFocused(false)} style={{width:'min(840px,calc(100vw - 32px))',maxHeight:'90vh',overflowY:'auto',border:'1px solid #dbe4df',borderRadius:18,padding:24}}>
 <div className="intro"><h2 id="stock-add-title">รับสินค้า / เพิ่มสินค้า</h2><button type="button" className="secondary" disabled={busy} onClick={()=>dialog.current?.close()} aria-label="ปิดฟอร์ม">ปิด</button></div>
 {!enabled?<p className="muted">ให้เจ้าของเชื่อม Google Sheets ด้านล่างก่อนเพิ่มสินค้า</p>:<form ref={formRef} className="form-grid" onSubmit={async event=>{
  event.preventDefault();if(busy)return;const form=event.currentTarget,f=new FormData(form);setBusy(true);setError('');setSuccess('');
  try{const prices=selected?[]:Array.from({length:4},(_,i)=>({pack:String(f.get('pack'+i)??'').trim(),price:String(f.get('price'+i)??'').trim()})).filter(p=>p.pack||p.price);
   const response=await fetch('/api/admin/stock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestKey,code:f.get('code'),name:f.get('name'),cost:f.get('cost'),quantity:f.get('quantity'),prices})});
   const result=await response.json();if(!response.ok){setError(result.error??'บันทึกไม่สำเร็จ');return;}
   form.reset();setQuery('');setSelected(null);setFocused(false);setActive(-1);setRequestKey(crypto.randomUUID());setSuccess((result.mode==='RECEIVED'?'รับสินค้าเพิ่ม ':'สร้างสินค้าใหม่ ')+result.code+' ใน Google Sheets สำเร็จ');router.refresh();
  }catch{setError('การเชื่อมต่อขัดข้อง ลองบันทึกฟอร์มเดิมอีกครั้งได้โดยไม่เพิ่มรายการซ้ำ');}finally{setBusy(false);}
 }}>
 <div style={{position:'relative'}}><label>รหัสสินค้า<input ref={codeRef} name="code" value={query} required maxLength={50} placeholder="พิมพ์บางส่วน เช่น NT" disabled={busy} autoComplete="off" role="combobox" aria-autocomplete="list" aria-controls="stock-code-options" aria-expanded={expanded} aria-activedescendant={expanded&&active>=0?'stock-code-option-'+active:undefined} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={event=>chooseCode(event.target.value)} onKeyDown={event=>{
  if(event.key==='ArrowDown'&&suggestions.length){event.preventDefault();setFocused(true);setActive(index=>Math.min(index+1,suggestions.length-1));}
  else if(event.key==='ArrowUp'&&suggestions.length){event.preventDefault();setActive(index=>Math.max(0,index-1));}
  else if(event.key==='Enter'&&expanded&&active>=0){event.preventDefault();chooseCode(suggestions[active].code,true);}
  else if(event.key==='Escape'&&expanded){event.preventDefault();event.stopPropagation();setFocused(false);}
 }}/></label>
 {expanded&&<ul id="stock-code-options" role="listbox" aria-label="รหัสสินค้าเดิมที่ตรงกัน" style={{position:'absolute',top:'100%',left:0,right:0,zIndex:5,listStyle:'none',padding:4,margin:0,border:'1px solid #dbe4df',borderRadius:10,background:'#fff',boxShadow:'0 8px 24px #0002',maxHeight:240,overflowY:'auto'}}>{suggestions.map((product,index)=><li key={product.code} id={'stock-code-option-'+index} role="option" aria-selected={index===active} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>chooseCode(product.code,true)} style={{padding:'10px 12px',cursor:'pointer',background:index===active?'#e6f2eb':'transparent',borderRadius:6}}><strong>{product.code}</strong><div className="small muted">{product.name??'ยังไม่ระบุชื่อ'} · คงเหลือ {amount(product.remainingQuantity)} G</div></li>)}</ul>}
 {focused&&query.trim()&&!suggestions.length&&<p className="small muted">ไม่พบรหัสเดิม จะสร้างสินค้าใหม่เมื่อบันทึก</p>}</div>
 <label>ชื่อสินค้า<input name="name" maxLength={200} disabled={busy} readOnly={!!selected?.name} placeholder={selected&&!selected.name?'ยังไม่ระบุชื่อ — กรอกชื่อได้':'ชื่อสินค้าใหม่'}/>{selected&&!selected.name&&<span className="small muted">กรอกชื่อเพื่อบันทึกกลับชีตได้</span>}</label>
 <label>ต้นทุน (บาท/G)<input type="number" name="cost" min="0" max="21474836.47" step="0.01" disabled={busy} readOnly={!!selected&&selected.costSatang!==null} placeholder={selected&&selected.costSatang===null?'ยังไม่ระบุต้นทุน':undefined}/></label>
 <label>จำนวนรับเพิ่ม (G)<input type="number" name="quantity" min="0" max="999999999" step="0.001" required disabled={busy}/></label>
 {selected?<div className="notice live" style={{gridColumn:'1 / -1'}}><strong>พบสินค้าเดิม {selected.code}</strong><p>ชื่อ: {selected.name??'ยังไม่ระบุชื่อ'} · จำนวนรับเดิม {amount(selected.receivedQuantity)} G · จำนวนจ่าย {amount(selected.issuedQuantity)} G · คงเหลือ {amount(selected.remainingQuantity)} G</p><p>กรอกจำนวนรับเพิ่ม ระบบคงราคาขายเดิมไว้ ต้นทุนที่ยังว่างกรอกเพิ่มได้ หากเติมเฉพาะต้นทุนให้ใส่จำนวน 0{!selected.name?' หากเพิ่มเฉพาะชื่อโดยยังไม่รับสินค้า ให้ใส่จำนวน 0':''}</p>{selected.salePrices.length>0&&<p>ราคาขายเดิม: {selected.salePrices.map(price=>price.pack+' · '+(price.priceSatang/100).toLocaleString('th-TH')+' บาท').join(' / ')}</p>}</div>:<>
 <p className="muted small" style={{gridColumn:'1 / -1'}}>รหัสใหม่: กรอกชื่อและต้นทุนด้วย ขนาดบรรจุกรอกเฉพาะตัวเลขหน่วย G ราคาขายเว้นว่างได้</p>
 {['10','50','100','1000'].map((pack,index)=><div key={index} style={{display:'flex',gap:12}}><label>ขนาดบรรจุ (G)<input type="number" min="0.001" max="999999999" step="0.001" name={'pack'+index} placeholder={pack} disabled={busy}/></label><label>ราคาขาย (บาท)<input name={'price'+index} type="number" min="0" max="21474836.47" step="0.01" disabled={busy}/></label></div>)}
 </>}
 {error&&<p role="alert" className="notice" style={{gridColumn:'1 / -1'}}>{error}</p>}{success&&<p role="status" className="notice live" style={{gridColumn:'1 / -1'}}>{success}</p>}<div><button disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกรับสินค้า'}</button></div>
 </form>}</dialog></>;
}