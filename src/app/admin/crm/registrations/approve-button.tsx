'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function ApproveRegistration({code}:{code:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 return <div><button disabled={busy} onClick={async()=>{
  setBusy(true);setError('');
  try{const response=await fetch('/api/admin/customer-registration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw Error(result.error);router.refresh();}
  catch(error){setError(error instanceof Error?error.message:'อนุมัติไม่สำเร็จ');}finally{setBusy(false);}
 }}>{busy?'กำลังอนุมัติ…':'อนุมัติสมาชิก'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
