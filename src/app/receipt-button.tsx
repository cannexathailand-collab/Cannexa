'use client';
import {useState} from 'react';

export function ReceiptButton({orderId,english=false,endpoint='/api/receipts',receiptBase='/receipts'}:{orderId:string;english?:boolean;endpoint?:string;receiptBase?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function open(){
  setBusy(true);setError('');
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId})});
   const result=await response.json();
   if(!response.ok)throw Error(english?result.english||'Unable to open receipt':result.error);
   window.location.assign(receiptBase+'/'+encodeURIComponent(result.id));
  }catch(failure){setError(failure instanceof Error?failure.message:'เปิดใบเสร็จไม่สำเร็จ');setBusy(false);}
 }
 return <div className="receipt-button"><button type="button" className="secondary" disabled={busy} onClick={open}>{busy?(english?'Preparing…':'กำลังเตรียม…'):(english?'Receipt':'ใบเสร็จรับเงิน')}</button>{error&&<p role="alert">{error}</p>}</div>;
}
