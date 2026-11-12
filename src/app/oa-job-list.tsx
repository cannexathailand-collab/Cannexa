'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useStockDeleteQueue} from './stock-delete-provider';
type Job={id:string;status:string;phase:string;cursor:number;error:string|null;review?:{code:string;name:string;text:string}[];results:{kind:string;code?:string;title?:string;url:string}[]};
const statuses:Record<string,string>={QUEUED:'รอทำงาน',RUNNING:'กำลังทำงาน',AWAITING_LOGIN:'รอเชื่อม LINE OA ใหม่',AWAITING_REVIEW:'รอตรวจผลค้นข้อมูล',COMPLETE:'บันทึกและตรวจสอบแล้ว',FAILED:'ต้องตรวจสอบก่อนทำต่อ'};
export function OaJobList(){
 const selection=useStockDeleteQueue(),requestKey=useRef<string|null>(null);
 const [jobs,setJobs]=useState<Job[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const selectedSignature=[...(selection?.selected??[])].sort().join('\0');
 useEffect(()=>{requestKey.current=null;},[selectedSignature]);
 useEffect(()=>{let live=true;async function read(){try{const r=await fetch('/api/admin/stock/line-oa-jobs',{cache:'no-store'});if(r.ok&&live)setJobs(await r.json());}catch{}}void read();const timer=setInterval(read,4000);return()=>{live=false;clearInterval(timer);};},[]);
 if(!selection?.enabled)return null;
 return <section className="card"><h2>สร้างการ์ดและข้อความตอบกลับ</h2><p>ใช้สินค้าที่เลือก ค้นข้อมูลก่อนบันทึก และแบ่งการ์ดไม่เกิน 5 ใบต่อชุด</p><p className="small">รอบทดสอบใช้ปุ่ม Order Now เปิดหน้าตัวอย่างตามรหัสสินค้า วิดีโอเดิมในข้อความจะยังอยู่ ส่วนดึงวิดีโอใหม่จาก Drive ยังไม่ได้เชื่อม</p>
 <div className="actions"><button disabled={busy||selection.busy||!selection.selected.size} type="button" onClick={async()=>{setBusy(true);setError('');try{requestKey.current??=crypto.randomUUID();const r=await fetch('/api/admin/stock/line-oa-jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes:[...selection.selected],requestKey:requestKey.current})});const data=await r.json();if(!r.ok)throw Error(data.error);requestKey.current=null;setJobs(old=>[data,...old.filter(j=>j.id!==data.id)]);}catch(e){setError(e instanceof Error?e.message:'ยังสร้างงานไม่ได้');}finally{setBusy(false);}}}>{busy?'กำลังรับงาน…':'สร้างการ์ดและข้อความตอบกลับใน LINE OA'}</button><Link href="/admin/line-browser">เชื่อม LINE OA บนเซิร์ฟเวอร์</Link></div>
 {error&&<p role="alert">{error}</p>}{jobs.map(job=><article key={job.id}><p role="status">{statuses[job.status]??'กำลังตรวจสอบ'}{job.status==='RUNNING'?' · '+(job.phase==='RESEARCH'?'ค้นข้อมูล':job.phase==='REPLIES'?'บันทึกข้อความ':'บันทึกการ์ด'):''}</p>{job.error&&<p>{job.error}</p>}{job.review?.map(p=><div key={p.code}><strong>{p.code} · {p.name}</strong><p style={{whiteSpace:"pre-wrap"}}>{p.text}</p></div>)}{["FAILED","AWAITING_REVIEW"].includes(job.status)&&<button type="button" className="secondary" onClick={async()=>{const r=await fetch("/api/admin/stock/line-oa-jobs/"+encodeURIComponent(job.id)+"/resume",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reviewed:job.status==="AWAITING_REVIEW"})});if(!r.ok)setError((await r.json()).error);}}>{job.status==="AWAITING_REVIEW"?"ตรวจข้อมูลแล้ว ดำเนินการต่อ":"ลองทำต่อจากจุดเดิม"}</button>}{job.results.map((r,i)=>r.url.startsWith('https://manager.line.biz/account/')?<p key={i}><a href={r.url} target="_blank" rel="noreferrer">{r.title??'ข้อมูล '+r.code}</a></p>:null)}</article>)}</section>;
}
