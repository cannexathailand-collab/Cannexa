'use client';
import {useState} from 'react';
export function CopyLinkButton({url}:{url:string}){const [message,setMessage]=useState('คัดลอกลิงก์');return <button type="button" className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(url);setMessage('คัดลอกแล้ว ✓');}catch{setMessage('กรุณาคัดลอกจากลิงก์ด้านล่าง');}}} aria-live="polite">{message}</button>;}
