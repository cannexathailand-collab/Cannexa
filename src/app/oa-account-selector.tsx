'use client';
import {useEffect,useRef,useState} from 'react';

export type OaAccounts={accounts:{account:string;name:string}[];defaultAccount:string;status:string;updatedAt?:string;error?:string|null;canRefresh:boolean};
export function useOaAccounts(){
 const [data,setData]=useState<OaAccounts|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;async function read(){try{const response=await fetch('/api/admin/line-browser/accounts',{cache:'no-store'});if(!response.ok)throw Error();const result=await response.json();if(live){setData(result);setError('');}}catch{if(live)setError('อ่านรายชื่อ OA ไม่สำเร็จ');}}void read();const timer=setInterval(read,4000);return()=>{live=false;clearInterval(timer);};},[]);
 async function refresh(){setBusy(true);setError('');try{const response=await fetch('/api/admin/line-browser/accounts',{method:'POST'});if(!response.ok)throw Error((await response.json()).error);setData(old=>old?{...old,status:'DISCOVER_REQUESTED'}:old);}catch(e){setError(e instanceof Error?e.message:'โหลดรายชื่อไม่ได้');}finally{setBusy(false);}}
 return {data,error,busy,refresh};
}
export function OaAccountSelector({value,onChange,onReady}:{value:string[];onChange:(value:string[])=>void;onReady:(value:boolean)=>void}){
 const {data,error,busy,refresh}=useOaAccounts(),initialized=useRef(false);
 useEffect(()=>{
  if(!data)return;
  if(!initialized.current&&data.accounts.length){initialized.current=true;onChange([data.accounts.find(account=>account.account===data.defaultAccount)?.account??data.accounts[0].account]);}
  else if(value.some(account=>!data.accounts.some(item=>item.account===account)))onChange(value.filter(account=>data.accounts.some(item=>item.account===account)));
  onReady(data.status==='READY'&&data.accounts.length>0);
 },[data,value,onChange,onReady]);
 return <fieldset style={{border:'1px solid #dce6df',borderRadius:10,padding:12}}><legend>LINE OA ปลายทาง · เลือกได้หลายร้าน</legend>
  {!data?.accounts.length&&<p>ยังไม่มีรายชื่อ OA</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:8,maxHeight:260,overflowY:'auto'}}>
   {data?.accounts.map(account=><label key={account.account} style={{display:'flex',alignItems:'center',gap:8,margin:0}}><input type="checkbox" checked={value.includes(account.account)} disabled={data.status!=='READY'||busy} onChange={event=>onChange(event.target.checked?[...value,account.account]:value.filter(item=>item!==account.account))}/><span>{account.name} ({account.account})</span></label>)}
  </div>
  <p className="small">เลือกแล้ว {value.length} ร้าน · ระบบจัดคิวทำงานทีละร้าน</p>
  <div className="actions"><button type="button" className="secondary" disabled={!data?.accounts.length||data.status!=='READY'} onClick={()=>onChange(data?.accounts.map(item=>item.account)??[])}>เลือกทั้งหมด</button><button type="button" className="secondary" disabled={!value.length} onClick={()=>onChange([])}>ล้างที่เลือก</button>
  {data?.canRefresh&&<button type="button" className="secondary" disabled={busy||data.status!=='READY'} onClick={()=>void refresh()}>โหลดรายชื่อ OA จากบัญชีที่เชื่อม</button>}</div>
  {data?.status==='DISCOVER_REQUESTED'&&<p role="status">กำลังโหลดรายชื่อ OA…</p>}
  {data&&data.status!=='READY'&&data.status!=='DISCOVER_REQUESTED'&&<p>กรุณาเชื่อม LINE OA ในหมวดการเชื่อมต่อ</p>}
  {(error||data?.error)&&<p role="alert">{error||data?.error}</p>}
 </fieldset>;
}
