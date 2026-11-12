'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useOaAccounts} from './oa-account-selector';
type State={account:string;status:string;sessionId:string|null;sessionExpiresAt:string|null;heartbeatAt:string|null}|null;
export function OaLoginPanel(){
 const accounts=useOaAccounts();
 const [state,setState]=useState<State>(null),[error,setError]=useState(''),[text,setText]=useState(''),[tick,setTick]=useState(0);
 useEffect(()=>{let live=true;async function read(){try{const r=await fetch('/api/admin/line-browser',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();if(live){setState(data);setTick(Date.now());}}catch{if(live)setError('อ่านสถานะไม่ได้ กรุณารีเฟรช');}}void read();const timer=setInterval(read,2500);return()=>{live=false;clearInterval(timer);};},[]);
 async function send(command:unknown,start=false){setError('');try{const r=await fetch('/api/admin/line-browser',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(start?{action:'start'}:{sessionId:state?.sessionId,command})});if(!r.ok)throw Error((await r.json()).error);}catch(e){setError(e instanceof Error?e.message:'ดำเนินการไม่ได้');}}
 const active=state?.status==='AWAITING_LOGIN';
 return <section className="card"><p>บัญชี: {state?.account??'ยังไม่เริ่มเชื่อม'}</p><p role="status">{state?.status==='READY'?'เชื่อมแล้ว':state?.status==='DISCOVER_REQUESTED'?'เชื่อมแล้ว · กำลังโหลดรายชื่อ OA':active?'ล็อกอินด้านล่าง แล้วกดตรวจการเชื่อมต่อ':state?.status==='LOGIN_REQUESTED'?'กำลังรอตัวทำงานเปิดหน้าล็อกอิน':'ยังไม่ได้เชื่อม หรือการล็อกอินหมดอายุ'}</p>{error&&<p role="alert">{error}</p>}
 <button type="button" onClick={()=>send(null,true)}>เชื่อม LINE OA ใหม่</button>
 {state?.status==='READY'&&<div><p>พบ {accounts.data?.accounts.length??0} OA สำหรับเลือกปลายทาง</p><button type="button" className="secondary" disabled={accounts.busy} onClick={()=>void accounts.refresh()}>โหลดรายชื่อ OA จากบัญชีที่เชื่อม</button><p><Link href="/admin/stock">เลือก OA และสร้างการ์ดในหน้าสต๊อก</Link></p></div>}
 {accounts.data?.status==='DISCOVER_REQUESTED'&&<p role="status">กำลังโหลดรายชื่อ OA…</p>}
 {(accounts.error||accounts.data?.error)&&<p role="alert">{accounts.error||accounts.data?.error}</p>}
 {state?.status==='LOGIN_REQUESTED'&&(!state.heartbeatAt||Date.now()-new Date(state.heartbeatAt).getTime()>60000)&&<p className="notice">ยังไม่ได้รับสัญญาณจากตัวทำงานบนเซิร์ฟเวอร์</p>}
 {active&&<><p>คลิกช่องบนภาพแล้วพิมพ์ผ่านช่องด้านล่าง หรือใช้ QR เข้าสู่ระบบกับ LINE ด้วยโทรศัพท์ของคุณ</p><img src={'/api/admin/line-browser/screen?t='+tick} alt="หน้าจอล็อกอิน LINE OA บนเซิร์ฟเวอร์" style={{width:'100%',maxWidth:1280,cursor:'crosshair'}} onClick={e=>{const b=e.currentTarget.getBoundingClientRect();void send({action:'click',x:Math.min(1279,Math.round((e.clientX-b.left)*1280/b.width)),y:Math.min(899,Math.round((e.clientY-b.top)*900/b.height))});}}/>
 <form onSubmit={e=>{e.preventDefault();const value=text;setText('');void send({action:'type',text:value});}}><label>พิมพ์ลงช่องที่เลือก<input type="password" autoComplete="off" value={text} onChange={e=>setText(e.target.value)} maxLength={1000}/></label><button disabled={!text}>พิมพ์</button></form>
 <div className="actions">{['Tab','Enter','Backspace','Escape'].map(key=><button type="button" className="secondary" key={key} onClick={()=>send({action:'key',key})}>{key}</button>)}<button type="button" className="secondary" onClick={()=>send({action:'scroll',y:500})}>เลื่อนลง</button><button type="button" className="secondary" onClick={()=>send({action:'scroll',y:-500})}>เลื่อนขึ้น</button><button type="button" onClick={()=>send({action:'verify'})}>ตรวจการเชื่อมต่อ</button></div></>}
 <p className="small">เมื่อ LINE ให้ล็อกอินใหม่ ระบบจะพักงานไว้ คุณกลับมาเชื่อมจากหน้านี้ได้ ข้อมูลการล็อกอินถูกเข้ารหัสและไม่แสดงออกจากระบบ</p></section>;
}
