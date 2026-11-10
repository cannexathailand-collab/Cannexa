'use client';
import {useCustomerLanguage} from '@/app/customer/language';

import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';

type Reward={id:string;name:string;description:string;points:number;availableUnits:number;imageVersion:string|null;expiryLabel:string};
type SelectedReward=Reward&{requestKey:string};

export function CustomerRewardTable({rewards,balance,delivery,readOnly=false}:{rewards:Reward[];balance:number;delivery:{recipient:string;phone:string;address:string};readOnly?:boolean}){
 const {t,locale}=useCustomerLanguage();
 const router=useRouter();
 const dialog=useRef<HTMLDialogElement>(null);
 const [selected,setSelected]=useState<SelectedReward|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false);
 const [resultStatus,setResultStatus]=useState('');
 const deliveryReady=!!delivery.recipient&&!!delivery.phone&&!!delivery.address;
 useEffect(()=>{if(selected&&!dialog.current?.open)dialog.current?.showModal();},[selected]);

 function select(reward:Reward){
  if(readOnly)return;
  setError('');setSuccess(false);setResultStatus('');setSelected({...reward,requestKey:crypto.randomUUID()});
 }
 async function redeem(){
  if(!selected||busy||readOnly)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/customer/rewards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rewardId:selected.id,requestKey:selected.requestKey,expectedPoints:selected.points,expectedRewardName:selected.name}),signal:AbortSignal.timeout(15000)});
   const result=await response.json();
   if(!response.ok){router.refresh();throw Error(result.error);}
   setResultStatus(result.status);setSuccess(true);router.refresh();
  }catch(error){setError(error instanceof Error?error.message:'แลกไม่สำเร็จ กรุณาลองใหม่');}finally{setBusy(false);}
 }
 return <>
  {readOnly?<p className="portal-muted">{t("โหมดเจ้าของระบบ · ดูข้อมูลการแลกเท่านั้น")}</p>:!deliveryReady&&<p className="portal-alert">{t("กรุณากรอกชื่อ เบอร์โทร และที่อยู่ในแท็บข้อมูลส่วนตัวให้ครบก่อนแลกของรางวัล")}</p>}
  {rewards.length?<div className="portal-reward-cards">{rewards.map(reward=><article className="portal-reward-card" key={reward.id}>
   <div className="portal-reward-image">{reward.imageVersion?<img src={'/api/rewards/'+reward.id+'/image?v='+reward.imageVersion} alt={reward.name} loading="lazy"/>:<span>{t("รูปของรางวัล")}</span>}</div>
   <div className="portal-reward-details"><h4>{reward.name}</h4>{reward.description&&<p>{reward.description}</p>}<strong>{reward.points.toLocaleString(locale)} Green Coin</strong><small className={reward.availableUnits<1?'is-empty':''}>{t(reward.availableUnits>0?'พร้อมแลก '+reward.availableUnits.toLocaleString('th-TH')+' ชิ้น':'ของรางวัลหมด')}</small><small className="portal-reward-expiry">{t(reward.expiryLabel)}</small><button disabled={readOnly||!deliveryReady||reward.availableUnits<1||balance<reward.points} onClick={()=>select(reward)}>{t("แลกของรางวัล")}</button></div>
  </article>)}</div>:<div className="portal-empty">{t("ยังไม่มีรายการของรางวัลที่เปิดให้แลก")}</div>}
  <dialog className="portal-reward-dialog" ref={dialog} aria-labelledby="reward-dialog-title" onClose={()=>setSelected(null)} onCancel={event=>{if(busy)event.preventDefault();}}>
   {selected&&<><h2 id="reward-dialog-title">{t(success?'ผลการแลกของรางวัล':'ยืนยันการแลกของรางวัล')}</h2><h3>{selected.name}</h3><p>{selected.points.toLocaleString(locale)} Green Coin</p><small>{t(selected.expiryLabel)}</small>
    {success?<p role="status" className="portal-success">{t(resultStatus==='REJECTED'?'รายการนี้ยกเลิกและคืน Green Coin แล้ว':resultStatus==='FULFILLED'?'ร้านส่งมอบของรางวัลแล้ว':'บันทึกรายการแล้ว รอร้านจัดส่งหรือส่งมอบของรางวัล')}</p>:<><p>{t("ข้อมูลจัดส่ง")}</p><address>{delivery.recipient}<br/>{delivery.phone}<br/>{delivery.address}</address>{error&&<p role="alert" className="portal-alert">{t(error)}</p>}</>}
    <div className="portal-reward-actions">{!success&&<button disabled={busy} onClick={redeem}>{t(busy?'กำลังยืนยัน…':'ยืนยันการแลก')}</button>}<button className="secondary" disabled={busy} onClick={()=>dialog.current?.close()}>{t(success?'ปิด':'ยกเลิก')}</button></div>
   </>}
  </dialog>
 </>;
}
