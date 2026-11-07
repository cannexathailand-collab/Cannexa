'use client';

import {useRef,useState,type ReactNode} from 'react';

export function CustomerPanels({orders,profile}:{orders:ReactNode;profile:ReactNode}){
 const [active,setActive]=useState('orders');
 const buttons=useRef<Array<HTMLButtonElement|null>>([]);
 const tabs=[{id:'orders',label:'ออเดอร์ของฉัน'},{id:'profile',label:'ข้อมูลส่วนตัว'}];

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
     onClick={()=>setActive(tab.id)}
     onKeyDown={event=>{
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
      event.preventDefault();
      const next=1-index;
      setActive(tabs[next].id);
      buttons.current[next]?.focus();
     }}
    >{tab.label}</button>)}
   </div>
   <a href="/customer/password?reset=1">เปลี่ยนรหัสผ่าน</a>
  </nav>
  <div id="panel-orders" role="tabpanel" aria-labelledby="tab-orders" hidden={active!=='orders'}>{orders}</div>
  <div id="panel-profile" role="tabpanel" aria-labelledby="tab-profile" hidden={active!=='profile'}>{profile}</div>
 </>;
}
