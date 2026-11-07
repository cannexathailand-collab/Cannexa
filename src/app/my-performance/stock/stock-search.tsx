'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
export function StockSearch({query,status,catalog}:{query:string;status:string;catalog:{code:string;name:string|null;available:number|null}[]}){
 const router=useRouter(),[value,setValue]=useState(query),[filter,setFilter]=useState(status),[pending,startTransition]=useTransition();
 const [focused,setFocused]=useState(false),[active,setActive]=useState(-1);
 const key=value.trim().toUpperCase();const suggestions=key?catalog.filter(p=>(p.code+" "+(p.name??"")).toUpperCase().includes(key)).sort((a,b)=>Number(!a.code.toUpperCase().startsWith(key))-Number(!b.code.toUpperCase().startsWith(key))).slice(0,10):[];
 const choose=(code:string)=>{setValue(code);setFocused(false);setActive(-1);search(code,filter,0);};
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),composing=useRef(false);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 function search(q:string,s:string,delay=300){if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{startTransition(()=>router.replace('/my-performance/stock?'+new URLSearchParams({q,status:s}),{scroll:false}));},delay);}
 return <form className="employee-stock-filters" role="search" onSubmit={event=>{event.preventDefault();search(value,filter,0);}}>
  <label style={{position:"relative"}}>ค้นหาสินค้า<input autoComplete="off" role="combobox" aria-expanded={focused&&suggestions.length>0} aria-controls="stock-suggestions" aria-autocomplete="list" aria-activedescendant={focused&&active>=0?"stock-option-"+active:undefined} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onKeyDown={event=>{if(event.key==="ArrowDown"){event.preventDefault();setActive(i=>Math.min(i+1,suggestions.length-1));}else if(event.key==="ArrowUp"){event.preventDefault();setActive(i=>Math.max(0,i-1));}else if(event.key==="Enter"&&focused&&active>=0&&suggestions[active]){event.preventDefault();choose(suggestions[active].code);}else if(event.key==="Escape")setFocused(false);}} name="q" value={value} maxLength={100} placeholder="พิมพ์รหัสหรือชื่อสินค้า" onCompositionStart={()=>{composing.current=true;if(timer.current)clearTimeout(timer.current);}} onCompositionEnd={event=>{composing.current=false;search(event.currentTarget.value,filter);}} onChange={event=>{setValue(event.target.value);setFocused(true);setActive(-1);if(!composing.current)search(event.target.value,filter);}}/>{focused&&suggestions.length>0&&<ul id="stock-suggestions" role="listbox" aria-label="สินค้าที่ใกล้เคียง" className="stock-search-suggestions">{suggestions.map((p,i)=><li key={p.code} id={"stock-option-"+i} role="option" aria-selected={active===i} onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>choose(p.code)}><strong>{p.code}</strong><span>{p.name} · ขายได้ {p.available===null?"รอตรวจสอบ":p.available.toLocaleString("th-TH")+" G"}</span></li>)}</ul>}</label>
  <label>สถานะ<select value={filter} onChange={event=>{setFilter(event.target.value);search(value,event.target.value,0);}}><option value="all">ทั้งหมด</option><option value="available">พร้อมขาย</option><option value="empty">หมด / ติดลบ</option><option value="unknown">รอตรวจสอบยอด</option></select></label>
  {(value||filter!=='all')&&<button type="button" onClick={()=>{setValue('');setFilter('all');search('','all',0);}}>ล้าง</button>}
  <span role="status" aria-live="polite" className="muted small">{pending?'กำลังค้นหา…':'ค้นหาอัตโนมัติ'}</span>
 </form>;
}
