'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {StockPriceColumn} from '@/lib/stock-price-columns';

type Details={code:string;name:string|null;costSatang:number|null;prices:StockPriceColumn[];fingerprint:string;receivedQuantity:number|null;remainingQuantity:number|null;deductedQuantity:number|null};
const quantityText=(value:number|null)=>value===null?'ยังไม่ระบุ':value.toLocaleString('th-TH',{maximumFractionDigits:3})+' G';

export function StockUpdateButton(props:Details&{enabled:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),router=useRouter();
 const [draft,setDraft]=useState<Details>(props),[requestKey,setRequestKey]=useState(''),[quantity,setQuantity]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [remove,setRemove]=useState(false);
 const added=Number(quantity)||0;
 const delta=remove?-added:added;
 const initialize=!remove&&added>0&&draft.receivedQuantity===null&&draft.remainingQuantity===null&&draft.deductedQuantity!==null;
 return <>
  <button type="button" className="secondary" disabled={!props.enabled} onClick={()=>{setDraft({...props,prices:props.prices.map(p=>({...p}))});setRequestKey(crypto.randomUUID());setQuantity('');setRemove(false);setError('');dialog.current?.showModal();}}>อัพเดต</button>
  <dialog className="stock-modal" ref={dialog} onCancel={e=>{if(busy)e.preventDefault();}}>
   <h2>อัพเดต {draft.code}</h2>
   <form key={requestKey} className="form-grid" onSubmit={async e=>{
    e.preventDefault();if(busy)return;
    const f=new FormData(e.currentTarget);
    const confirmation='ยืนยันอัพเดต '+draft.code+(added>0?(remove?' และลดจำนวน ':' และรับสินค้าเพิ่ม ')+quantityText(added):'')+'?';
    if(!window.confirm(confirmation))return;
    setBusy(true);setError('');
    try{
     const response=await fetch('/api/admin/stock/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestKey,code:draft.code,expectedFingerprint:draft.fingerprint,name:f.get('name'),cost:f.get('cost'),quantity:added,removeQuantity:remove?true:undefined,prices:draft.prices.map(p=>({columnIndex:p.columnIndex,pack:p.pack,price:f.get('price'+p.columnIndex)}))})});
     const data=await response.json();if(!response.ok){setError(data.error??'บันทึกไม่ได้');return;}
     dialog.current?.close();router.refresh();
    }catch{setError('เชื่อมต่อขัดข้อง ลองบันทึกชุดเดิมได้โดยไม่บันทึกซ้ำ');}finally{setBusy(false);}
   }}>
    <label>ชื่อสินค้า<input name="name" maxLength={200} defaultValue={draft.name??''} disabled={busy} placeholder="ยังไม่มีชื่อ"/></label>
    <label>ต้นทุน (บาท/G)<input name="cost" type="number" min="0" max="21474836.47" step="0.01" required={draft.costSatang!==null} defaultValue={draft.costSatang===null?'':draft.costSatang/100} disabled={busy} placeholder="ต้นทุนว่าง"/></label>
    <label>ปรับจำนวนสินค้า<select value={remove?'REMOVE':'ADD'} onChange={e=>setRemove(e.target.value==='REMOVE')} disabled={busy}><option value="ADD">เพิ่มจำนวน</option><option value="REMOVE">ลดจำนวน</option></select></label>
    <label>{remove?'จำนวนที่ลด (G)':'จำนวนรับเพิ่ม (G)'}<input name="quantity" type="number" min="0" max="999999999" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} disabled={busy} placeholder="0"/></label>
    <div className="notice" style={{gridColumn:'1 / -1'}}>
     จำนวนรับ {quantityText(draft.receivedQuantity)} → {quantityText(initialize?draft.deductedQuantity!+added:draft.receivedQuantity===null?null:draft.receivedQuantity+delta)}
     <br/>คงเหลือ {quantityText(draft.remainingQuantity)} → {quantityText(initialize?added:draft.remainingQuantity===null?null:draft.remainingQuantity+delta)}
     {initialize&&<p>ยอดเดิมว่าง เริ่มคงเหลือจาก 0 G แล้วบวกจำนวนที่รับเพิ่ม</p>}
    </div>
    {draft.prices.map(p=><label key={p.columnIndex}>ราคาขาย {p.pack} (บาท)<input name={'price'+p.columnIndex} type="number" min="0" max="21474836.47" step="0.01" defaultValue={p.priceSatang===null?'':p.priceSatang/100} disabled={busy}/></label>)}
    <p className="small muted" style={{gridColumn:'1 / -1'}}>เลือกเพิ่มหรือลดแล้วกรอกจำนวน ยอดคงเหลือคำนวณอัตโนมัติ เว้นว่างหรือใส่ 0 เพื่อแก้เฉพาะข้อมูลสินค้า</p>
    {error&&<p className="notice" role="alert" style={{gridColumn:'1 / -1'}}>{error}</p>}
    <div className="actions" style={{gridColumn:'1 / -1'}}><button disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกอัพเดต'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>dialog.current?.close()}>ยกเลิก</button></div>
   </form>
  </dialog>
 </>;
}
