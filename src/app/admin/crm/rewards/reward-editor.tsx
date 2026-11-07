'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';

type Reward={id:string;name:string;description:string;points:number;availableUnits:number;enabled:boolean;updatedAt:string};

export function RewardEditor({reward,requestKey,editable}:{reward?:Reward;requestKey:string;editable:boolean}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [saved,setSaved]=useState(false);
 return <form onSubmit={async event=>{
  event.preventDefault();if(busy)return;
  const element=event.currentTarget,form=new FormData(element);
  setBusy(true);setError('');setSaved(false);
  try{
   const response=await fetch('/api/admin/crm/rewards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:reward?.id,requestKey,name:form.get('name'),description:form.get('description'),points:Number(form.get('points')),availableUnits:Number(form.get('availableUnits')),enabled:form.get('enabled')==='on',expectedUpdatedAt:reward?.updatedAt})});
   const result=await response.json();if(!response.ok)throw Error(result.error);
   if(!reward)element.reset();setSaved(true);router.refresh();
  }catch(error){setError(error instanceof Error?error.message:'บันทึกไม่สำเร็จ');}finally{setBusy(false);}
 }}>
  <fieldset disabled={!editable||busy}>
   <label>ชื่อของรางวัล<input name="name" required maxLength={120} defaultValue={reward?.name??''}/></label>
   <label>รายละเอียด<textarea name="description" maxLength={1000} defaultValue={reward?.description??''}/></label>
   <div className="reward-editor-numbers"><label>Green Coin ที่ใช้แลก<input name="points" type="number" min={1} max={1000000000} step={1} required defaultValue={reward?.points??''}/></label><label>จำนวนพร้อมแลก<input name="availableUnits" type="number" min={0} max={1000000} step={1} required defaultValue={reward?.availableUnits??0}/></label></div>
   <label><input name="enabled" type="checkbox" defaultChecked={reward?.enabled??false}/> เปิดให้ลูกค้าแลก</label>
   {error&&<p role="alert" className="notice">{error}</p>}
   {saved&&<p role="status">บันทึกของรางวัลแล้ว</p>}
   <button disabled={busy}>{busy?'กำลังบันทึก…':'บันทึกของรางวัล'}</button>
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
