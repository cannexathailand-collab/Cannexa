'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {useCustomerLanguage} from './language';

type MotionPreference='auto'|'on'|'off';
const storageKey='cannexa:platinum-border-motion';

export function PlatinumCardFrame({children}:{children:ReactNode}){
 const {t}=useCustomerLanguage();
 const [preference,setPreference]=useState<MotionPreference>('auto');
 const [reducedMotion,setReducedMotion]=useState(true);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setReducedMotion(media.matches);
  update();media.addEventListener('change',update);
  try{const saved=localStorage.getItem(storageKey);if(saved==='on'||saved==='off')setPreference(saved);}catch{}
  return()=>media.removeEventListener('change',update);
 },[]);
 const moving=preference==='on'||preference==='auto'&&!reducedMotion;
 function toggle(){
  const next=moving?'off':'on';setPreference(next);
  try{localStorage.setItem(storageKey,next);}catch{}
 }
 return <div className="platinum-card-wrap">
  <div className="portal-member-card portal-member-vip" data-motion={moving?'on':'off'}>
   {children}
   <svg className="platinum-border" aria-hidden="true" focusable="false">
    <rect className="platinum-border-glow" x="2" y="2" rx="18" pathLength="100"/>
    <rect className="platinum-border-light" x="2" y="2" rx="18" pathLength="100"/>
   </svg>
  </div>
  <button type="button" className="platinum-motion-toggle" aria-pressed={moving} onClick={toggle}>{t(moving?'หยุดแสงวิ่ง':'เปิดแสงวิ่ง')}</button>
 </div>;
}
