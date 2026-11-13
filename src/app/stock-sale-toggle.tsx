'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
export function StockSaleToggle({code,enabled,version,editable}:{code:string;enabled:boolean;version:string;editable:boolean}){
 const router=useRouter(),[saved,setSaved]=useState({enabled,version}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setSaved({enabled,version});},[enabled,version]);
 return <div style={{marginTop:8}}>
  <button type="button" role="switch" aria-checked={saved.enabled} aria-label={'สถานะพร้อมขาย '+code} disabled={!editable||busy} className="secondary" style={{padding:'4px 9px',fontSize:12,borderColor:saved.enabled?'#86bca0':'#c1c7c4',color:saved.enabled?'#18633a':'#647069'}} onClick={async()=>{
   if(busy)return;setBusy(true);setError('');
   try{const response=await fetch('/api/admin/stock/availability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,enabled:!saved.enabled,version:saved.version})});const result=await response.json();if(!response.ok){setError(result.error??'บันทึกสถานะไม่ได้');return;}setSaved({enabled:result.enabled,version:result.version});router.refresh();}
   catch{setError('การเชื่อมต่อขัดข้อง กรุณาลองใหม่');}finally{setBusy(false);}
  }}>{busy?'กำลังบันทึก…':saved.enabled?'● พร้อมขาย':'○ ไม่พร้อมขาย'}</button>
  {error&&<p className="small notice" role="alert">{error}</p>}
 </div>;
}
