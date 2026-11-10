'use client';
import {useState} from 'react';
export function ReceiptActions({text,english}:{text:string;english:boolean}){
 const [message,setMessage]=useState('');
 return <div className="receipt-actions"><button onClick={()=>window.print()}>{english?'Print / Save PDF':'พิมพ์ / บันทึก PDF'}</button><button onClick={async()=>{
  try{await navigator.clipboard.writeText(text);setMessage(english?'Copied':'คัดลอกแล้ว');}catch{setMessage(english?'Copy unavailable. Please select the receipt text.':'คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความในใบเสร็จ');}
 }}>{english?'Copy receipt':'คัดลอกใบเสร็จ'}</button><span role="status">{message}</span></div>;
}
