'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';

export function OrderRowActions({id,version,canEdit,canCancel}:{id:string;version:string;canEdit:boolean;canCancel:boolean}){
 const router=useRouter(),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=useRef(''),expectedVersion=useRef(version),sending=useRef(false);
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 async function cancel(){
  if(sending.current)return;sending.current=true;setBusy(true);setError('');key.current||=crypto.randomUUID();
  try{
   const response=await fetch('/api/admin/orders/change',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'CANCEL',expectedVersion:expectedVersion.current,requestKey:key.current}),signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   setConfirm(false);router.refresh();
  }catch(failure){setError(failure instanceof Error?failure.message:'ยังยืนยันผลไม่ได้ กรุณาลองอีกครั้ง');}finally{sending.current=false;setBusy(false);}
 }
 return <div>
  <div className="actions">
   <Link className="button secondary" href={'/admin/orders/list/'+encodeURIComponent(id)}>ดูรายละเอียด</Link>
   {canEdit&&<Link className="button secondary" href={'/admin/orders/'+encodeURIComponent(id)+'/edit'}>แก้ไข</Link>}
   {canCancel&&<button type="button" className="secondary" disabled={busy||!ready} onClick={()=>{expectedVersion.current=version;key.current='';setError('');setConfirm(true);}}>ยกเลิก</button>}
  </div>
  {confirm&&canCancel&&<div className="notice" style={{whiteSpace:'normal',maxWidth:300}}>
   <p>ยืนยันยกเลิกออเดอร์นี้และคืนยอดจองสินค้า?</p>
   <div className="actions"><button type="button" disabled={busy} onClick={cancel}>{busy?'กำลังยกเลิก…':'ยืนยันยกเลิก'}</button><button type="button" className="secondary" disabled={busy} onClick={()=>setConfirm(false)}>กลับ</button></div>
  </div>}
  {error&&<p role="alert" className="notice" style={{whiteSpace:'normal',maxWidth:300}}>{error}</p>}
 </div>;
}
