'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';

type Reward={id:string;name:string;description:string;points:number;availableUnits:number;enabled:boolean;updatedAt:string;imageVersion:string|null;endsOn:string;expiryLabel:string;expired:boolean};

function readImage(file:File):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result));
  reader.onerror=()=>reject(Error('อ่านรูปไม่สำเร็จ กรุณาเลือกรูปอีกครั้ง'));
  reader.readAsDataURL(file);
 });
}

export function RewardEditor({reward,requestKey,editable}:{reward?:Reward;requestKey:string;editable:boolean}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [saved,setSaved]=useState(false);
 const [editing,setEditing]=useState(!reward);
 const [file,setFile]=useState<File|null>(null);
 const imageUrl=useMemo(()=>file?URL.createObjectURL(file):reward?.imageVersion?'/api/rewards/'+reward.id+'/image?v='+reward.imageVersion:null,[file,reward?.id,reward?.imageVersion]);
 useEffect(()=>()=>{if(file&&imageUrl)URL.revokeObjectURL(imageUrl);},[file,imageUrl]);
 return <form className="reward-editor-card" onSubmit={async event=>{
  event.preventDefault();if(busy)return;
  const element=event.currentTarget,form=new FormData(element);
  setBusy(true);setError('');setSaved(false);
  try{
   const image=file?await readImage(file):undefined;
   const response=await fetch('/api/admin/crm/rewards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:reward?.id,requestKey,name:form.get('name'),description:form.get('description'),points:Number(form.get('points')),availableUnits:Number(form.get('availableUnits')),enabled:form.get('enabled')==='on',endsOn:form.get('endsOn'),expectedUpdatedAt:reward?.updatedAt,image})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   if(!reward)element.reset();else setEditing(false);
   setFile(null);setSaved(true);router.refresh();
  }catch(error){setError(error instanceof Error?error.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false);}
 }}>
  <fieldset className="reward-editor-grid" disabled={!editable||busy}>
   <div className="reward-editor-image">
    {imageUrl?<img src={imageUrl} alt={reward?.name??'ภาพตัวอย่างของรางวัล'}/>:<div className="reward-image-placeholder"><span aria-hidden="true">＋</span>รูปของรางวัล</div>}
    {editing&&<label className="reward-image-upload">{imageUrl?'เปลี่ยนรูป':'เพิ่มรูป'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{
     const selected=event.target.files?.[0];if(!selected)return;
     if(!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>2*1024*1024){setError('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 2 MB');event.target.value='';return;}
     setError('');setFile(selected);
    }}/></label>}
    {editing&&<small>JPG, PNG, WebP · ไม่เกิน 2 MB</small>}
   </div>
   <div className="reward-editor-details">
    {editing?<><h2>{reward?'แก้ไขของรางวัล':'เพิ่มของรางวัล'}</h2><label>ชื่อของรางวัล<input name="name" required maxLength={120} defaultValue={reward?.name??''}/></label>
     <label>รายละเอียด<textarea name="description" rows={2} maxLength={1000} defaultValue={reward?.description??''}/></label>
     <div className="reward-editor-numbers"><label>Green Coin ที่ใช้แลก<input name="points" type="number" min={1} max={1000000000} step={1} required defaultValue={reward?.points??''}/></label><label>จำนวนพร้อมแลก<input name="availableUnits" type="number" min={0} max={1000000} step={1} required defaultValue={reward?.availableUnits??0}/></label></div>
     <label>แลกได้ถึงวันที่<input name="endsOn" type="date" defaultValue={reward?.endsOn??''}/><small>เว้นว่างหากไม่กำหนดวันสิ้นสุด</small></label>
     <label><input name="enabled" type="checkbox" defaultChecked={reward?.enabled??false}/> เปิดให้ลูกค้าแลก</label>
     <div className="reward-resolution"><button disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกของรางวัล'}</button>{reward&&<button type="button" className="secondary" onClick={()=>{setEditing(false);setFile(null);setError('');}}>ยกเลิก</button>}</div>
    </>:<><span className={'reward-availability '+(reward?.enabled&&!reward?.expired?'is-enabled':'')}>{reward?.expired?'หมดเขตแลก':reward?.enabled?'เปิดให้แลก':'ปิดอยู่'}</span><h2>{reward?.name}</h2><p>{reward?.description||'ยังไม่ได้ระบุรายละเอียด'}</p><div className="reward-card-stats"><strong>{reward?.points.toLocaleString('th-TH')} Green Coin</strong><span>พร้อมแลก {reward?.availableUnits.toLocaleString('th-TH')} ชิ้น</span></div><small className="reward-expiry">{reward?.expiryLabel}</small>{editable&&<button type="button" className="secondary" onClick={()=>{setEditing(true);setSaved(false);}}>แก้ไขของรางวัล</button>}</>}
    {error&&<p role="alert" className="notice">{error}</p>}
    {saved&&<p role="status">บันทึกของรางวัลแล้ว</p>}
   </div>
  </fieldset>
 </form>;
}

export function RedemptionActions({id}:{id:string}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function resolve(status:'FULFILLED'|'REJECTED'){
  if(busy)return;setBusy(true);setError('');
  try{
   const response=await fetch('/api/admin/crm/reward-redemptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});
   const result=await response.json();if(!response.ok)throw Error(result.error);router.refresh();
  }catch(error){setError(error instanceof Error?error.message:'ดำเนินการไม่สำเร็จ');}finally{setBusy(false);}
 }
 return <div className="reward-resolution"><button disabled={busy} onClick={()=>resolve('FULFILLED')}>ส่งมอบแล้ว</button><button className="secondary" disabled={busy} onClick={()=>resolve('REJECTED')}>ยกเลิกและคืนเหรียญ</button>{error&&<p role="alert">{error}</p>}</div>;
}
