'use client';

import {useState} from 'react';

export function CustomerEntryLinks({baseUrl}:{baseUrl:string}){
 const [message,setMessage]=useState('');
 const entrances=[
  {id:'password',title:'รหัสลูกค้าและรหัสผ่าน',description:'ลูกค้าใช้รหัสและรหัสผ่านที่ตั้งไว้ เข้าจากมือถือหรือคอมพิวเตอร์ได้',path:'/customer/sign-in',tag:'Customer'},
  {id:'line',title:'เข้าสู่ระบบด้วย LINE',description:'ลูกค้าใช้บัญชี LINE ที่ผูกไว้เพื่อเข้าข้อมูลสมาชิกของตนเอง',path:'/customer',tag:'LINE'},
  {id:'marketing',title:'ลิงก์การตลาด',description:'LINE Login เพิ่มเพื่อนและยืนยันอายุ แล้วเข้าสู่หน้าลูกค้าได้เลย กรอกข้อมูลจัดส่งตอนสั่งซื้อ พร้อมติดตามที่มาและยอดขาย',path:'/marketing',tag:'Marketing'},
 ];
 return <>
  <div className="customer-entry-grid">{entrances.map(entrance=>{
   const url=baseUrl+entrance.path;
   return <section className={'customer-entry-card'+(entrance.id==='marketing'?' customer-entry-marketing':'')} key={entrance.id}>
    <span className="customer-entry-tag">{entrance.tag}</span>
    <h2>{entrance.title}</h2>
    <p>{entrance.description}</p>
    <label htmlFor={'entry-'+entrance.id}>ลิงก์ทางเข้าลูกค้า</label>
    <input id={'entry-'+entrance.id} value={url} readOnly onFocus={event=>event.currentTarget.select()}/>
    <div className="customer-entry-actions">
     <button type="button" onClick={async()=>{
      try{await navigator.clipboard.writeText(url);setMessage('คัดลอกลิงก์ '+entrance.title+' แล้ว');}
      catch{setMessage('กรุณาเลือกและคัดลอกลิงก์จากช่อง '+entrance.title);}
     }}>คัดลอกลิงก์</button>
     <a className="button secondary" href={entrance.path} target="_blank" rel="noopener noreferrer">เปิดหน้า</a>
    </div>
   </section>;
  })}</div>
  {message&&<p className="notice live" role="status">{message}</p>}
  <p className="muted">ทุกทางเข้าใช้ข้อมูลลูกค้า Member, Green Coin และออเดอร์ชุดเดียวกัน ลูกค้าที่ใช้รหัสผ่านต้องตั้งรหัสผ่านผ่านบัญชี LINE ที่ผูกไว้ก่อน</p>
 </>;
}
