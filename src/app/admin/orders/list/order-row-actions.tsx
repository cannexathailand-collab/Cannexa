'use client';
import {PopupDetails} from '@/app/popup-details';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';

export function OrderRowActions({id,orderNumber,version,canEdit,canCancel}:{id:string;orderNumber:string;version:string;canEdit:boolean;canCancel:boolean}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=useRef(''),expectedVersion=useRef(version),sending=useRef(false);
 async function cancel(){
  if(sending.current)return;sending.current=true;setBusy(true);setError('');key.current||=crypto.randomUUID();
  try{
   const response=await fetch('/api/admin/orders/change',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action:'CANCEL',expectedVersion:expectedVersion.current,requestKey:key.current}),signal:AbortSignal.timeout(60000)});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   router.refresh();
  }catch(failure){setError(failure instanceof Error?failure.message:'ยังยืนยันผลไม่ได้ กรุณาลองอีกครั้ง');}finally{sending.current=false;setBusy(false);}
 }
 return <div className="order-row-actions">
  {canEdit&&<Link className="button secondary" href={'/admin/orders/'+encodeURIComponent(id)+'/edit'}>แก้ไข</Link>}
  {canCancel&&<PopupDetails onOpen={()=>{expectedVersion.current=version;key.current='';setError('');}} className="order-cancel" summaryClassName="order-cancel-trigger" summary="ยกเลิกออเดอร์" title="ยืนยันยกเลิกออเดอร์"><p className="order-cancel-reference">{orderNumber}</p><p>ยืนยันยกเลิกออเดอร์นี้และคืนยอดจองสินค้า?</p>{error&&<p role="alert" className="notice">{error}</p>}<button type="button" className="order-cancel-confirm" disabled={busy} onClick={cancel}>{busy?'กำลังยกเลิก…':'ยืนยันยกเลิก'}</button></PopupDetails>}
 </div>;
}
