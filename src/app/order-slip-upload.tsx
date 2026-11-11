'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';

export function OrderSlipUpload({orderId}:{orderId:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 return <form onSubmit={async event=>{
  event.preventDefault();if(busy)return;const form=event.currentTarget,file=(form.elements.namedItem('slip') as HTMLInputElement).files?.[0];
  if(!file)return;setError('');setBusy(true);
  try{
   if(file.size>2*1024*1024)throw Error('รูปสลิปต้องมีขนาดไม่เกิน 2 MB');
   const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('อ่านรูปไม่สำเร็จ'));reader.readAsDataURL(file);});
   const response=await fetch('/api/admin/orders/'+encodeURIComponent(orderId)+'/slip',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'แนบสลิปไม่สำเร็จ');form.reset();router.refresh();
  }catch(error){setError(error instanceof Error?error.message:'แนบสลิปไม่สำเร็จ');}finally{setBusy(false);}
 }}>
  <label>แนบสลิปการโอนเงิน<input type="file" name="slip" accept="image/jpeg,image/png,image/webp" required disabled={busy}/></label>
  <button disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกสลิป'}</button>
  {error&&<p role="alert">{error}</p>}
 </form>;
}
