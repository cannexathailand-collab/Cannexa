'use client';
import {useState} from 'react';
export function CopyOrderShipping({text}:{text:string}){
 const [copied,setCopied]=useState(false),[manual,setManual]=useState(false);
 return <div className="order-shipping-copy"><button type="button" onClick={async()=>{
  try{await navigator.clipboard.writeText(text);setCopied(true);setManual(false);}
  catch{setCopied(false);setManual(true);}
 }}>{copied?'คัดลอกแล้ว ✓':'คัดลอกข้อมูลจัดส่ง'}</button>{copied&&<p role="status">คัดลอกข้อมูลออเดอร์แล้ว</p>}{manual&&<label>เลือกข้อความเพื่อคัดลอก<textarea readOnly value={text} rows={10} onFocus={event=>event.currentTarget.select()}/></label>}</div>;
}
