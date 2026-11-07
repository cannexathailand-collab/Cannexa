'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
export function StockSearch({query,status}:{query:string;status:string}){
 const router=useRouter(),[value,setValue]=useState(query),[filter,setFilter]=useState(status),[pending,startTransition]=useTransition();
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),composing=useRef(false);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 function search(q:string,s:string,delay=300){if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>{startTransition(()=>router.replace('/my-performance/stock?'+new URLSearchParams({q,status:s}),{scroll:false}));},delay);}
 return <form className="employee-stock-filters" role="search" onSubmit={event=>{event.preventDefault();search(value,filter,0);}}>
  <label>ค้นหาสินค้า<input name="q" value={value} maxLength={100} placeholder="พิมพ์รหัสหรือชื่อสินค้า" onCompositionStart={()=>{composing.current=true;if(timer.current)clearTimeout(timer.current);}} onCompositionEnd={event=>{composing.current=false;search(event.currentTarget.value,filter);}} onChange={event=>{setValue(event.target.value);if(!composing.current)search(event.target.value,filter);}}/></label>
  <label>สถานะ<select value={filter} onChange={event=>{setFilter(event.target.value);search(value,event.target.value,0);}}><option value="all">ทั้งหมด</option><option value="available">พร้อมขาย</option><option value="empty">หมด / ติดลบ</option><option value="unknown">รอตรวจสอบยอด</option></select></label>
  {(value||filter!=='all')&&<button type="button" onClick={()=>{setValue('');setFilter('all');search('','all',0);}}>ล้าง</button>}
  <span role="status" aria-live="polite" className="muted small">{pending?'กำลังค้นหา…':'ค้นหาอัตโนมัติ'}</span>
 </form>;
}
