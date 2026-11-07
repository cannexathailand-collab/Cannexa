'use client';
import {useRef,useState} from 'react';
import Link from 'next/link';
import {crmFilterFields} from '@/lib/crm-customer-filters';
type Params=Record<string,string|undefined>;
const allowed=['from','to','view',...crmFilterFields.flatMap(([key])=>[key+'Min',key+'Max'])];
export function CrmFiltersForm({params}:{params:Params}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [q,setQ]=useState(params.q??''),[sort,setSort]=useState(params.sort??'frequencyDesc');
 const initial=()=>crmFilterFields.filter(([key])=>params[key+'Min']||params[key+'Max']).map(([key])=>key);
 const [fields,setFields]=useState<string[]>(initial),[next,setNext]=useState('');
 const active=initial().length+(params.from||params.to?1:0);
 return <>
 <form action="/admin/crm" className="crm-toolbar">
  <label className="crm-search">ค้นหาลูกค้า<input name="q" value={q} onChange={e=>setQ(e.target.value)} placeholder="รหัส ชื่อ เบอร์ หรือผู้แนะนำ"/></label>
  <label>แสดงผล<select aria-label="แสดงผล" name="sort" value={sort} onChange={e=>{setSort(e.target.value);e.currentTarget.form?.requestSubmit();}}><option value="frequencyDesc">ลูกค้าที่ซื้อบ่อยที่สุด</option><option value="spendDesc">ลูกค้าที่ซื้อเยอะที่สุด</option><option value="profitDesc">ลูกค้าที่ทำกำไรมากที่สุด</option><option value="pointsDesc">ลูกค้าที่มี Green Coin มากที่สุด</option><option value="monthlyDesc">ลูกค้าที่มียอดซื้อเฉลี่ยต่อเดือนสูงที่สุด</option><option value="gapAsc">ลูกค้าที่กลับมาซื้อเร็วที่สุด</option></select></label>
  {allowed.filter(key=>params[key]).map(key=><input type="hidden" name={key} value={params[key]} key={key}/>)}
  <button type="submit">ค้นหา</button>
  <button type="button" className="secondary" onClick={()=>{setFields(initial());setNext('');dialog.current?.querySelector('form')?.reset();dialog.current?.showModal();}}>ตัวกรอง{active?' ('+active+')':''}</button>
  {!!active&&<Link href="/admin/crm" className="button secondary">ล้างตัวกรอง</Link>}
 </form>
 <dialog ref={dialog} className="stock-modal crm-filter-dialog" onCancel={()=>dialog.current?.querySelector('form')?.reset()}>
  <h2>ตัวกรองลูกค้า</h2><p className="muted">เลือกเฉพาะเงื่อนไขที่ต้องการ</p>
  <form action="/admin/crm">
   <input type="hidden" name="q" value={q}/><input type="hidden" name="sort" value={sort}/><input type="hidden" name="view" value={params.view??'day'}/>
   <div className="crm-date-row"><label>วันที่สั่งซื้อตั้งแต่<input type="date" name="from" defaultValue={params.from??''}/></label><label>ถึงวันที่<input type="date" name="to" defaultValue={params.to??''}/></label></div>
   {fields.map(key=><div className="crm-filter-row" key={key}><strong>{crmFilterFields.find(([field])=>field===key)?.[1]}</strong><label>ขั้นต่ำ<input type="number" name={key+'Min'} step="any" defaultValue={params[key+'Min']??''}/></label><label>สูงสุด<input type="number" name={key+'Max'} step="any" defaultValue={params[key+'Max']??''}/></label><button type="button" className="secondary" aria-label={'ลบตัวกรอง '+crmFilterFields.find(([field])=>field===key)?.[1]} onClick={()=>setFields(fields.filter(field=>field!==key))}>ลบ</button></div>)}
   {fields.length<crmFilterFields.length&&<div className="crm-add-filter"><label>เพิ่มเงื่อนไข<select value={next} onChange={e=>setNext(e.target.value)}><option value="">เลือกตัวกรอง</option>{crmFilterFields.filter(([key])=>!fields.includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button type="button" className="secondary" disabled={!next} onClick={()=>{setFields([...fields,next]);setNext('');}}>เพิ่ม</button></div>}
   <p className="muted small">เกณฑ์ตัวเลขใช้ข้อมูลตลอดอายุลูกค้า ช่วงวันที่ใช้กับประวัติเมื่อเปิดรายละเอียด</p>
   <div className="actions"><button type="submit">ใช้ตัวกรอง</button><button type="button" className="secondary" onClick={()=>{dialog.current?.querySelector('form')?.reset();dialog.current?.close();}}>ยกเลิก</button></div>
  </form>
 </dialog>
 </>;
}
