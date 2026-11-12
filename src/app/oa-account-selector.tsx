'use client';
import {useEffect,useState} from 'react';

export type OaAccounts={accounts:{account:string;name:string}[];defaultAccount:string;status:string;updatedAt?:string;error?:string|null;canRefresh:boolean};
export function useOaAccounts(){
 const [data,setData]=useState<OaAccounts|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;async function read(){try{const response=await fetch('/api/admin/line-browser/accounts',{cache:'no-store'});if(!response.ok)throw Error();const result=await response.json();if(live){setData(result);setError('');}}catch{if(live)setError('อ่านรายชื่อ OA ไม่สำเร็จ');}}void read();const timer=setInterval(read,4000);return()=>{live=false;clearInterval(timer);};},[]);
 async function refresh(){setBusy(true);setError('');try{const response=await fetch('/api/admin/line-browser/accounts',{method:'POST'});if(!response.ok)throw Error((await response.json()).error);setData(old=>old?{...old,status:'DISCOVER_REQUESTED'}:old);}catch(e){setError(e instanceof Error?e.message:'โหลดรายชื่อไม่ได้');}finally{setBusy(false);}}
 return {data,error,busy,refresh};
}
export function OaAccountSelector({value,onChange,onReady}:{value:string;onChange:(value:string)=>void;onReady:(value:boolean)=>void}){
 const {data,error,busy,refresh}=useOaAccounts();
 useEffect(()=>{
  if(!data)return;
  if(!data.accounts.some(account=>account.account===value))onChange(data.accounts.find(account=>account.account===data.defaultAccount)?.account??data.accounts[0]?.account??'');
  onReady(data.status==='READY'&&data.accounts.length>0);
 },[data,value,onChange,onReady]);
 return <div>
  <label>LINE OA ปลายทาง<select value={value} onChange={event=>onChange(event.target.value)} disabled={!data?.accounts.length||data.status!=='READY'}>
   {!data?.accounts.length&&<option value="">ยังไม่มีรายชื่อ OA</option>}
   {data?.accounts.map(account=><option key={account.account} value={account.account}>{account.name} ({account.account})</option>)}
  </select></label>
  {value&&<p className="small">งานนี้จะสร้างลง {data?.accounts.find(account=>account.account===value)?.name??value}</p>}
  {data?.canRefresh&&<button type="button" className="secondary" disabled={busy||data.status!=='READY'} onClick={()=>void refresh()}>โหลดรายชื่อ OA จากบัญชีที่เชื่อม</button>}
  {data?.status==='DISCOVER_REQUESTED'&&<p role="status">กำลังโหลดรายชื่อ OA…</p>}
  {data&&data.status!=='READY'&&data.status!=='DISCOVER_REQUESTED'&&<p>กรุณาเชื่อม LINE OA ในหมวดการเชื่อมต่อ</p>}
  {(error||data?.error)&&<p role="alert">{error||data?.error}</p>}
 </div>;
}
