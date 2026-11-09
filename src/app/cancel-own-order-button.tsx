'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {PopupDetails} from './popup-details';
export function CancelOwnOrderButton({id,version,orderNumber}:{id:string;version:string;orderNumber:string}){
 const router=useRouter(),requestKey=useRef(''),sending=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 return <PopupDetails summary="ยกเลิกออเดอร์" title="ยืนยันยกเลิกออเดอร์">
  <p>{orderNumber}</p><p>ยืนยันยกเลิกรายการนี้และคืนยอดจองสินค้า?</p>
  {error&&<p role="alert">{error}</p>}
  {done?<p role="status">ยกเลิกออเดอร์แล้ว</p>:<button disabled={busy} onClick={async()=>{
   if(sending.current)return;
   sending.current=true;setBusy(true);setError('');requestKey.current||=crypto.randomUUID();
   try{
    const response=await fetch('/api/my-performance/orders/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,expectedVersion:version,requestKey:requestKey.current}),signal:AbortSignal.timeout(60000)});
    const result=await response.json();if(!response.ok)throw Error(result.error);
    setDone(true);router.refresh();
   }catch(failure){setError(failure instanceof Error?failure.message:'ยกเลิกไม่สำเร็จ กรุณาลองใหม่');}
   finally{sending.current=false;setBusy(false);}
  }}>{busy?'กำลังยกเลิก…':'ยืนยันยกเลิก'}</button>}
 </PopupDetails>;
}
