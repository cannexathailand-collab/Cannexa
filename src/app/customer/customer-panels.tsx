'use client';

import {useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {CustomerPasswordForm} from './password/password-form';

export function CustomerPanels({orders,profile,promotions,coins,passwordRequiresCurrent=false,readOnly=false}:{orders:ReactNode;profile:ReactNode;promotions:ReactNode;coins:ReactNode;passwordRequiresCurrent?:boolean;readOnly?:boolean}){
 const [active,setActive]=useState('orders');
 const router=useRouter();
 const buttons=useRef<Array<HTMLButtonElement|null>>([]);
 const tabs=[{id:'orders',label:'ออเดอร์ของฉัน'},{id:'profile',label:'ข้อมูลส่วนตัว'},...(!readOnly?[{id:'password',label:'เปลี่ยนรหัสผ่าน'}]:[]),{id:'promotions',label:'โปรโมชั่น'},{id:'coins',label:'Green Coin'}];
 function selectTab(id:string){
  setActive(id);
  if(id==='promotions'||id==='coins')router.refresh();
 }

 return <>
  <nav className="portal-tabs" aria-label="เมนูลูกค้า">
   <div className="portal-tab-controls" role="tablist" aria-label="ข้อมูลลูกค้า">
    {tabs.map((tab,index)=><button
     key={tab.id}
     ref={element=>{buttons.current[index]=element;}}
     type="button"
     role="tab"
     id={'tab-'+tab.id}
     aria-controls={'panel-'+tab.id}
     aria-selected={active===tab.id}
     tabIndex={active===tab.id?0:-1}
     onClick={()=>selectTab(tab.id)}
     onKeyDown={event=>{
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
      event.preventDefault();
      const direction=event.key==='ArrowRight'?1:-1;
      const next=(index+direction+tabs.length)%tabs.length;
      selectTab(tabs[next].id);
      buttons.current[next]?.focus();
     }}
    >{tab.label}</button>)}
   </div>
  </nav>
  <div id="panel-orders" role="tabpanel" aria-labelledby="tab-orders" hidden={active!=='orders'}>{orders}</div>
  <div id="panel-profile" role="tabpanel" aria-labelledby="tab-profile" hidden={active!=='profile'}>{profile}</div>
  {!readOnly&&<div id="panel-password" role="tabpanel" aria-labelledby="tab-password" hidden={active!=='password'}>
   <section className="portal-section"><h2>เปลี่ยนรหัสผ่าน</h2><CustomerPasswordForm setup reset inline requiresCurrentPassword={passwordRequiresCurrent}/></section>
  </div>}
  <div id="panel-promotions" role="tabpanel" aria-labelledby="tab-promotions" hidden={active!=='promotions'}>{promotions}</div>
  <div id="panel-coins" role="tabpanel" aria-labelledby="tab-coins" hidden={active!=='coins'}>{coins}</div>
 </>;
}
