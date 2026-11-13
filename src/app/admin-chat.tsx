'use client';
import {useRef,useState} from 'react';
import type {ChatSource,ChatTable} from '@/lib/admin-chat';
type Message={role:'user'|'assistant';content:string;sources?:ChatSource[];tables?:ChatTable[]};
export function AdminChat({ready,endpoint='/api/admin/chat'}:{ready:boolean;endpoint?:string}){
 const [messages,setMessages]=useState<Message[]>([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const end=useRef<HTMLDivElement>(null);
 async function send(){
  const text=question.trim();if(!text||busy||!ready)return;
  setBusy(true);setError('');
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:messages.slice(-12).map(({role,content})=>({role,content:content.slice(0,6000)}))})});
   const result=await response.json();if(!response.ok)throw Error(result.error??'ยังตอบไม่ได้');
   setMessages(current=>[...current,{role:'user',content:text},{role:'assistant',content:result.answer,sources:result.sources,tables:result.tables}]);setQuestion('');
   requestAnimationFrame(()=>end.current?.scrollIntoView({behavior:'smooth',block:'nearest'}));
  }catch(e){setError(e instanceof Error?e.message:'ยังตอบไม่ได้ กรุณาลองใหม่');}
  finally{setBusy(false);}
 }
 return <section className="card admin-ai-chat" aria-label="Chat AI หลังบ้าน">
  <div className="intro"><div><h2>ถามข้อมูลร้านของคุณ</h2><p className="small muted">อ่านข้อมูลตามสิทธิ์ · ไม่แก้ไขข้อมูลหรือส่งข้อความให้ลูกค้า</p></div><button type="button" className="secondary" disabled={busy||!messages.length} onClick={()=>{setMessages([]);setError('');}}>เริ่มแชทใหม่</button></div>
  {!ready&&<p className="notice">ยังไม่ได้เชื่อม AI สำหรับร้านนี้ ให้เจ้าของร้านตั้งค่าที่เมนูเชื่อม OpenAI ก่อน</p>}
  <div className="actions">{['ยอดขายและกำไรวันนี้เป็นเท่าไร','สินค้าไหนคงเหลือน้อยกว่า 100 กรัม','ลูกค้าที่ไม่ได้สั่งซื้อ 90 วันมีใครบ้าง'].map(text=><button key={text} type="button" className="secondary" disabled={busy||!ready} onClick={()=>setQuestion(text)}>{text}</button>)}</div>
  <div className="admin-ai-conversation" role="log" aria-live="polite" aria-label="บทสนทนากับ AI">
   {!messages.length&&<p className="muted">พิมพ์คำถามได้เลย เช่น ยอดขาย รายรับ รายจ่าย กำไร หรือสต๊อก หากข้อมูลไม่พอ AI จะถามกลับหรือแจ้งว่าอ่านไม่ได้</p>}
   {messages.map((message,index)=><article key={index} className={'admin-ai-message '+message.role}><strong>{message.role==='user'?'คุณ':'AI'}</strong><p>{message.content}</p>{message.tables?.map((table,ti)=><section key={ti}><h3>{table.title} · {table.total} รายการ</h3><div className="table-wrap"><table><thead><tr>{table.columns.map(column=><th key={column}>{column}</th>)}<th>รายละเอียด</th></tr></thead><tbody>{table.rows.map((row,ri)=><tr key={ri}>{row.cells.map((cell,ci)=><td key={ci}>{cell}</td>)}<td>{row.url&&<a href={row.url} target="_blank" rel="noreferrer">ดูข้อมูล</a>}</td></tr>)}</tbody></table></div>{table.total>table.rows.length&&<p className="small">แสดง {table.rows.length} จาก {table.total} รายการ กรุณาระบุเงื่อนไขเพิ่มเพื่อจำกัดผล</p>}</section>)}{!!message.sources?.length&&<div className="admin-ai-sources"><strong>ข้อมูลที่ใช้</strong>{message.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<small>อ่านเมื่อ {new Date(source.readAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</small></a>)}</div>}</article>)}
   {busy&&<p role="status">กำลังอ่านข้อมูลและเตรียมคำตอบ…</p>}<div ref={end}/>
  </div>
  <form onSubmit={event=>{event.preventDefault();void send();}}><label htmlFor="admin-ai-question">ถาม AI<textarea id="admin-ai-question" value={question} onChange={event=>setQuestion(event.target.value)} disabled={busy||!ready} maxLength={3000} rows={3} placeholder="พิมพ์คำถามเกี่ยวกับข้อมูลร้าน…" onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send();}}}/></label><div className="actions"><button disabled={busy||!ready||!question.trim()}>{busy?'กำลังตอบ…':'ส่งคำถาม'}</button><span className="small muted">Enter เพื่อส่ง · Shift+Enter ขึ้นบรรทัดใหม่</span></div></form>
  {error&&<p role="alert" className="notice">{error}</p>}
  <p className="small muted">คำตอบ AI อาจคลาดเคลื่อน ตรวจตัวเลขและช่วงวันที่จากลิงก์รายงานก่อนใช้ตัดสินใจ ประวัติแชทอยู่ในหน้านี้และจะหายเมื่อปิดหรือรีเฟรช</p>
 </section>;
}
