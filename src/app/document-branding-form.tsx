'use client';
import {useMemo,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';

type Brand={name:string;color:string;footer:string;logoVersion:string|null;version:string};
export function DocumentBrandingForm({initial,endpoint='/api/admin/document-branding',logoBase='/api/branding/logo/'}:{initial:Brand|null;endpoint?:string;logoBase?:string}){
 const router=useRouter();
 const [file,setFile]=useState<File|null>(null),[remove,setRemove]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const preview=useMemo(()=>file?URL.createObjectURL(file):null,[file]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 const image=preview??(!remove&&initial?.logoVersion?logoBase+initial.logoVersion:null);
 return <form className="form-grid" onSubmit={async event=>{
  event.preventDefault();setBusy(true);setMessage('');const form=new FormData(event.currentTarget);
  try{
   const logo=file?await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('อ่านโลโก้ไม่สำเร็จ'));reader.readAsDataURL(file);}):remove?null:undefined;
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.get('name'),color:form.get('color'),footer:form.get('footer'),expectedVersion:initial?.version??null,...(logo!==undefined?{logo}:{})})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   setFile(null);setRemove(false);setMessage('บันทึกแบรนด์แล้ว');router.refresh();
  }catch(error){setMessage(error instanceof Error?error.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false);}
 }}>
  <label>ชื่อแบรนด์ / ร้านค้า<input name="name" maxLength={150} defaultValue={initial?.name}/></label>
  <label>สีแบรนด์<input name="color" type="color" defaultValue={initial?.color??'#087c59'}/></label>
  <label>โลโก้ร้าน<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event=>{
   const selected=event.target.files?.[0];event.target.value='';if(!selected)return;
   if(selected.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(selected.type)){setMessage('ใช้ไฟล์ PNG, JPG หรือ WebP ไม่เกิน 2 MB');return;}
   setFile(selected);setRemove(false);setMessage('');
  }}/></label>
  {image&&<div><img src={image} alt="ตัวอย่างโลโก้ร้าน" style={{maxWidth:200,maxHeight:100,objectFit:'contain'}}/><button type="button" className="secondary" onClick={()=>{setFile(null);setRemove(true);}}>ลบโลโก้</button></div>}
  <label style={{gridColumn:'1 / -1'}}>ข้อความท้ายเอกสาร<textarea name="footer" rows={2} maxLength={500} defaultValue={initial?.footer}/></label>
  <div><button disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกแบรนด์'}</button>{message&&<p role="status">{message}</p>}</div>
 </form>;
}
