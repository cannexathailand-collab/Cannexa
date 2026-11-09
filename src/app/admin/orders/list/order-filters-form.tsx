'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import type {OrderFilters} from '@/lib/order-management';

type Values={q:string;team:string;status:string;payment:string;sort:string;page:string};
export function OrderFiltersForm({filters,teams,states,rounds}:{filters:OrderFilters;teams:{id:string;name:string}[];states:[string,string][];rounds:{page:string;label:string}[]}){
 const router=useRouter(),[pending,startTransition]=useTransition();
 const initial={q:filters.q??'',team:filters.team??'',status:filters.status??'ALL',payment:filters.payment??'',sort:filters.sort??'newest',page:filters.page??'1'};
 const [values,setValues]=useState<Values>(initial);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),composing=useRef(false);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 useEffect(()=>{
  if(!pending&&!timer.current&&!composing.current)setValues({q:filters.q??'',team:filters.team??'',status:filters.status??'ALL',payment:filters.payment??'',sort:filters.sort??'newest',page:filters.page??'1'});
 },[filters.q,filters.team,filters.status,filters.payment,filters.sort,filters.page,pending]);
 function search(next:Values,delay=250){
  if(timer.current)clearTimeout(timer.current);
  timer.current=setTimeout(()=>{
   timer.current=null;
   const params=new URLSearchParams(next);
   for(const [key,value]of [...params])if(!value)params.delete(key);
   startTransition(()=>router.replace('/admin/orders/list?'+params.toString(),{scroll:false}));
  },delay);
 }
 function change(key:keyof Values,value:string,delay=0){const next={...values,[key]:value};setValues(next);search(next,delay);}
 return <form method="get" action="/admin/orders/list" className="order-filters" aria-busy={pending} onSubmit={event=>{event.preventDefault();if(!composing.current)search(values,0);}}>
  <label className="order-search">ค้นหาออเดอร์<input name="q" value={values.q} maxLength={100} autoComplete="off" placeholder="เลขออเดอร์ ชื่อ เบอร์ รหัสลูกค้า หรือเลขพัสดุ" onCompositionStart={()=>{composing.current=true;if(timer.current){clearTimeout(timer.current);timer.current=null;}}} onCompositionEnd={event=>{composing.current=false;change('q',event.currentTarget.value,250);}} onChange={event=>{const next={...values,q:event.target.value};setValues(next);if(!composing.current)search(next);}}/></label>
  <label>รอบออเดอร์<select name="page" value={values.page} onChange={event=>change('page',event.target.value)}>{rounds.map(round=><option key={round.page} value={round.page}>{round.label}</option>)}</select></label>
  <label>ทีม / บ้าน<select name="team" value={values.team} onChange={event=>change('team',event.target.value)}><option value="">ทุกทีม</option>{teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
  <label>สถานะ<select name="status" value={values.status} onChange={event=>change('status',event.target.value)}>{states.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <label>การชำระ<select name="payment" value={values.payment} onChange={event=>change('payment',event.target.value)}><option value="">ทั้งหมด</option><option value="โอน">โอน</option><option value="COD">COD</option><option value="เคลม">เคลม</option></select></label>
  <label>เรียงตาม<select name="sort" value={values.sort} onChange={event=>change('sort',event.target.value)}><option value="newest">ใหม่ที่สุดก่อน</option><option value="oldest">เก่าที่สุดก่อน</option></select></label>
  <div className="actions"><button type="submit">ค้นหา</button><Link className="button secondary" href="/admin/orders/list">ล้างค่า</Link><span role="status" className="muted small">{pending?'กำลังค้นหา…':'ค้นหาอัตโนมัติ'}</span></div>
 </form>;
}
