import Link from 'next/link';
import {cookies} from 'next/headers';
import {requireAdminPage} from '@/lib/auth';
import {db} from '@/lib/db';
import {readToken,sha} from '@/lib/crypto';
import {lineSettings} from '@/lib/line-settings';
import {loadOrderRoundSettings} from '@/lib/order-round-settings';
import {CopyOrderShipping} from '@/app/copy-order-shipping';
export default async function ProfitReportPage({searchParams}:{searchParams:Promise<{status?:string}>}){
 const actor=await requireAdminPage();
 const [setting,connection,round,latest,{status}]=await Promise.all([
  db.ownerProfitReport.findUnique({where:{id:actor.username}}),lineSettings(),loadOrderRoundSettings(),db.profitReportDelivery.findFirst({orderBy:{day:'desc'}}),searchParams,
 ]);
 const token=readToken<{purpose:string;actor:string;code:string;exp:number}>((await cookies()).get('profit_report_binding')?.value??'');
 const binding=token?.purpose==='profit-report-binding'&&token.actor===actor.username&&token.exp>Date.now()&&setting?.bindingHash===sha(token.code)&&setting?.bindingExpiresAt&&setting.bindingExpiresAt>new Date()?token:null;
 const linked=!!setting?.recipientUserId&&setting.botId===connection?.settings.botId;
 const ready=!!connection?.settings.accessToken;
 const text=binding?'ผูกรายงาน '+binding.code:'';
 return <>
  <div className="intro"><div><h1>รายงานยอดขายเข้า LINE</h1><p>สรุปยอดขาย ยอดโอน ยอด COD และกำไรขั้นต้นทุกวัน ตอนตัดรอบ {round.closeTime} น.</p></div><Link className="button secondary" href="/admin/sales">กลับยอดขาย</Link></div>
  {status==='error'&&<p role="alert" className="notice">บันทึกไม่สำเร็จ ตรวจการเชื่อม LINE และลองอีกครั้ง</p>}
  {status==='disconnected'&&<p role="status">ยกเลิกการผูก LINE และหยุดส่งรายงานแล้ว</p>}
  {status==='saved'&&<p role="status">บันทึกแล้ว</p>}
  <section className="card"><h2>ผู้รับรายงาน</h2><p>{linked?(setting?.enabled?'ผูก LINE แล้ว · เปิดส่งอัตโนมัติ':'ผูก LINE แล้ว · หยุดส่งอัตโนมัติ'):'รอผูก LINE ผู้รับรายงาน'}</p>
   <p>ใช้ยอดของรอบที่เพิ่งปิดจากหน้ายอดขาย กำไรขั้นต้นคำนวณจากยอดขายหักต้นทุนสินค้า และระบุเมื่อต้นทุนยังเป็นประมาณการ</p>
   {!ready?<p><Link href="/admin/line">ตั้งค่าการเชื่อมต่อ LINE OA</Link></p>:<>
    <form action="/api/admin/profit-report" method="post"><input type="hidden" name="action" value="bind"/><button>{linked?'เปลี่ยน LINE ผู้รับรายงาน':'สร้างรหัสผูก LINE'}</button></form>
    {binding&&<div className="notice"><p>ส่งข้อความนี้จาก LINE ส่วนตัวของคุณไปหา OA {connection?.settings.basicId} ภายใน 15 นาที</p><p><code>{text}</code></p><CopyOrderShipping text={text} label="คัดลอกข้อความผูก LINE" successMessage="คัดลอกข้อความผูก LINE แล้ว"/><p><a href={'https://line.me/R/ti/p/'+encodeURIComponent(connection!.settings.basicId)} target="_blank" rel="noreferrer">เปิด LINE OA</a></p><p>เมื่อส่งแล้ว ให้โหลดหน้านี้ใหม่เพื่อดูสถานะ</p></div>}
    {linked&&<form action="/api/admin/profit-report" method="post"><input type="hidden" name="action" value={setting?.enabled?'disable':'enable'}/><button className="secondary">{setting?.enabled?'หยุดส่งรายงาน':'เปิดส่งรายงานทุกวัน'}</button></form>}
   </>}
   {(setting?.recipientUserId||setting?.bindingHash)&&<form action="/api/admin/profit-report" method="post"><input type="hidden" name="action" value="disconnect"/><button className="secondary">ยกเลิกการผูก LINE</button></form>}
  </section>
  <section className="card"><h2>รายงานล่าสุด</h2>{latest?<><p>รอบวันที่ {latest.day} · {latest.status==='SENT'?'LINE รับข้อความแล้ว':latest.status==='CANCELLED'?'ยกเลิกการส่งแล้ว':latest.status==='REJECTED'?'LINE ปฏิเสธการส่ง กรุณาตรวจการเชื่อมต่อ':latest.status==='FAILED'?'ส่งไม่สำเร็จ ระบบจะลองใหม่':'รอดำเนินการ'}</p><pre style={{whiteSpace:'pre-wrap'}}>{latest.text}</pre></>:<p>ยังไม่มีประวัติส่งรายงาน</p>}</section>
 </>;
}
