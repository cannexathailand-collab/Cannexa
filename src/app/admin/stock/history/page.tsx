import {stockAvailableQuantity} from '@/lib/stock-available';
import {compareStockCodes} from '@/lib/stock-sort';
import {StockDispatchHistory} from '@/app/stock-dispatch-history';
import Link from 'next/link';
import {requireAdminPage} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {db} from '@/lib/db';
import {STOCK_SHEET_URL} from '@/lib/stock-google';
import {bangkokDay,dayStart,shiftDay} from '@/lib/sales-dates';
import {stockHistoryDate} from '@/lib/stock-history-plan';
import {filterStockProducts,stockFilter,stockFilterLabels} from '@/lib/stock-filters';
import type {StockRow} from '@/lib/stock-import';

const number=(v:number|null)=>v===null?'—':v.toLocaleString('th-TH',{maximumFractionDigits:3});
const dateLabel=(day:string)=>dayStart(day).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'});
export default async function StockHistory({searchParams}:{searchParams:Promise<{day?:string;q?:string;filter?:string;status?:string;dispatchPage?:string}>}){
 const actor=await requireAdminPage(approvers),params=await searchParams;
 const [config,recent,pending]=await Promise.all([
  db.stockHistoryConfig.findUnique({where:{id:'active'}}),
  db.stockDailySnapshot.findMany({orderBy:{day:'desc'},take:31,select:{day:true}}),
  db.stockDailySnapshot.count({where:{status:'PENDING'}})
 ]);
 const today=bangkokDay(new Date()),latestClosedDay=shiftDay(today,-1);
 const day=stockHistoryDate(params.day,today),q=(params.q??'').trim().slice(0,100),filter=stockFilter(params.filter);
 const snapshot=await db.stockDailySnapshot.findUnique({where:{day}});
 const all=snapshot?.products as StockRow[]|undefined,products=filterStockProducts(all??[],q,filter).sort((a,b)=>compareStockCodes(a.code,b.code));
 const pendingMode=all?.some(p=>p.completedQuantity!==undefined);
 const baseline=await db.stockSheetOperation.findUnique({where:{id:'baseline-v1'}});
 const backup=(baseline?.snapshot as any)?.archive;
 return <>
  <div className="intro sales-header"><div><div className="eyebrow">บัญชี / สต๊อก / รายการย้อนหลัง</div><h1>รายการย้อนหลัง</h1><p className="muted">รายการจัดส่งที่ผูกกับสต๊อก และยอดปิดรายวันที่เก็บไว้</p></div><Link className="button secondary" href="/admin/stock">กลับสต๊อกปัจจุบัน</Link></div>
  <section className="card">
   <form method="get" className="form-grid">
    <label>วันที่ต้องการดู<input type="date" name="day" defaultValue={day} max={today}/></label>
    <label>ค้นหารหัสหรือชื่อสินค้า<input name="q" defaultValue={q} maxLength={100} placeholder="รหัสหรือชื่อสินค้า"/></label>
    <label>ตัวกรอง<select name="filter" defaultValue={filter}>{Object.entries(stockFilterLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <div className="actions"><button>ดูประวัติ</button></div>
   </form>
   {recent.length>0&&<details><summary>วันที่มีประวัติ ({recent.length} วันล่าสุด)</summary><div className="actions" style={{flexWrap:'wrap',marginTop:12}}>{recent.map(item=><Link key={item.day} href={'/admin/stock/history?day='+item.day} className="button secondary">{dateLabel(item.day)}</Link>)}</div></details>}
  </section>
  {params.status==='busy'&&<p className="notice" role="status">มีการแก้ไขสต๊อกอยู่ รอสักครู่แล้วลองอีกครั้ง</p>}
  {params.status==='failed'&&<p className="notice" role="status">ยังส่งประวัติไป Google Sheets ไม่ครบ ข้อมูลที่บันทึกแล้วจะถูกใช้ต่อเมื่อกดลองใหม่</p>}
  {params.status==='saved'&&<p className="notice live" role="status">ตรวจยอดปิดและรายการที่รอบันทึกแล้ว</p>}
  <section className="card">
   <div className="intro"><h2>ยอดปิดวันที่ {dateLabel(day)}</h2>{snapshot&&<span className="pill">{products.length} จาก {all?.length??0} รายการ</span>}</div>
   {snapshot?<>
    <p className="muted small">บันทึกจริง {snapshot.capturedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})} · จากชีต {snapshot.sourceSheet}</p>
    <p className="muted small">{pendingMode?'จำนวนรับและจำนวนรอจ่ายแสดงตามค่าที่บันทึกไว้ ณ เวลานั้น':'จำนวนรับและจ่ายเป็นยอดสะสม ณ เวลาบันทึก'} ประวัติจะไม่เปลี่ยนตามสต๊อกปัจจุบัน</p>
    {snapshot.status==='COMPLETE'?<p><a href={STOCK_SHEET_URL+'#gid='+snapshot.sheetId} target="_blank" rel="noreferrer">เปิดแท็บ {snapshot.sheetTitle} ใน Google Sheets</a></p>:<p className="notice">เก็บประวัติในระบบแล้ว กำลังรอส่งสำเนาไป Google Sheets</p>}
    {products.length?<div className="table-wrap"><table><thead><tr><th>รหัสสินค้า</th><th>สินค้า</th><th>จำนวนรับ (G)</th><th>{pendingMode?'จำนวนรอจ่าย (G)':'จำนวนจ่าย (G)'}</th><th>คงเหลือ (G)</th><th>จำนวนสินค้าที่สามารถขายได้ (G)</th><th>ต้นทุน (บาท/G)</th><th>ราคาขาย (บาท)</th></tr></thead><tbody>{products.map(p=><tr key={p.code}><td><strong>{p.code}</strong></td><td>{p.name??'ยังไม่ระบุชื่อ'}</td><td>{number(p.receivedQuantity)}</td><td>{number(p.issuedQuantity)}</td><td><strong>{number(p.remainingQuantity)}</strong></td><td><strong>{number(stockAvailableQuantity(p))}</strong></td><td>{p.costSatang===null?'ยังไม่ระบุต้นทุน':number(p.costSatang/100)}</td><td>{p.salePrices.length?p.salePrices.map((price,i)=><div key={i} style={{whiteSpace:'nowrap'}}>{price.pack} · {number(price.priceSatang/100)}</div>):'ยังไม่ระบุราคา'}</td></tr>)}</tbody></table></div>:<p className="muted">{q||filter!=='all'?'ไม่พบสินค้าที่ตรงกับตัวกรอง':'ไม่มีสินค้าในยอดปิดวันนี้'}</p>}
   </>:<p className="muted">{config&&day<config.startDay?'ยังไม่ได้เปิดเก็บประวัติในวันที่เลือก จึงไม่มีข้อมูลย้อนหลังของวันนั้น':day>=today?'วันนี้ยังไม่ปิดวัน ประวัติจะพร้อมหลังสิ้นวัน':recent.length?'ไม่มีประวัติที่บันทึกไว้สำหรับวันนี้':'ยังไม่มีรอบปิดวัน ประวัติชุดแรกจะพร้อมหลังสิ้นวัน'}</p>}
  </section>
  {backup&&baseline?.status==='APPLIED'&&<p className="muted"><a href={STOCK_SHEET_URL+'#gid='+backup.sheetId} target="_blank" rel="noreferrer">ยอดก่อนเริ่มรอบจำนวนรอจ่าย</a> · เก็บข้อมูลเดิมก่อนเปลี่ยนระบบ</p>}
  <StockDispatchHistory day={day} page={params.dispatchPage}/>
  <section className="card"><h2>การเก็บประวัติ</h2>
   <p>เก็บอัตโนมัติหลังสิ้นวันตามเวลาไทย{config&&<> เริ่มวันที่ {dateLabel(config.startDay)}</>} และเก็บยอดก่อนรายการแก้ไขแรกของวันใหม่ เพื่อไม่ให้ยอดวันใหม่ทับวันก่อน</p>
   <p className="muted small">แสดงเวลาที่อ่านข้อมูลจริงทุกครั้ง การแก้ไขโดยตรงใน Google Sheets ก่อนระบบบันทึกอาจรวมอยู่ในยอดนี้ วันที่ไม่มีข้อมูลจะไม่สร้างยอดย้อนหลังขึ้นเอง</p>
   {pending>0&&<p className="notice">รอส่งสำเนาไป Google Sheets {pending} วัน</p>}
   {actor.role==='owner'&&<form action="/api/admin/stock/history/retry" method="post"><button className="secondary">ตรวจและบันทึกยอดปิดที่ค้าง</button></form>}
  </section>
 </>;
}
