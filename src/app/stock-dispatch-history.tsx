import Link from 'next/link';
import {db} from '@/lib/db';
import {dayStart,shiftDay} from '@/lib/sales-dates';

export async function StockDispatchHistory({day,page:input}:{day:string;page?:string}){
 const where={dispatchedAt:{gte:dayStart(day),lt:dayStart(shiftDay(day,1))},status:{not:'EXCLUDED'}};
 const total=await db.stockDispatch.count({where}),pages=Math.max(1,Math.ceil(total/50)),requested=Number(input);
 const page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,pages):1;
 const rows=await db.stockDispatch.findMany({where,orderBy:[{dispatchedAt:'desc'},{id:'desc'}],skip:(page-1)*50,take:50});
 const pageLink=(n:number)=>'/admin/stock/history?'+new URLSearchParams({day,dispatchPage:String(n)})+'#dispatch-history';
 const number=(v:unknown)=>typeof v==='number'?v.toLocaleString('th-TH',{maximumFractionDigits:3}):'—';
 return <section className="card" id="dispatch-history">
  <div className="intro"><h2>รายการจัดส่งและตัดสต๊อก</h2><span className="pill">{total} ออเดอร์</span></div>
  <p className="muted small">แยกตามวันที่ยืนยันจัดส่งจริง รายการรอต้นทุนจะยังไม่ตัดสต๊อกหรือคิดต้นทุนเป็นศูนย์</p>
  {rows.length?<div className="table-wrap"><table><thead><tr><th>วันที่จัดส่ง</th><th>ออเดอร์ / พัสดุ</th><th>สถานะ</th><th>สินค้าและจำนวน (G)</th><th>คงเหลือก่อน → หลัง (G)</th><th>ต้นทุนที่บันทึก (บาท)</th></tr></thead><tbody>{rows.map(row=>{
   const items=Array.isArray(row.items)?row.items as Record<string,any>[]:[];
   const status:Record<string,string>={POSTED:'ตัดสต๊อกและบันทึกต้นทุนแล้ว',PENDING:'รอประมวลผล',WAITING_COST:'รอต้นทุน',NEEDS_REVIEW:'รอตรวจสอบ'};
   return <tr key={row.id}><td>{row.dispatchedAt?.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}<div className="muted small">{row.processedAt&&'บันทึก '+row.processedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</div></td><td><Link href={'/admin/orders/'+encodeURIComponent(row.orderId)+'/review'}>{row.orderNumber}</Link><div>{row.tracking??row.candidateTracking??'—'}</div></td><td>{status[row.status]??'รอตรวจสอบ'}</td><td>{items.map((item,i)=><div key={i}>{item.code} · {number(typeof item.quantityMilliG==='number'?item.quantityMilliG/1000:null)}{item.name&&' · '+item.name}</div>)}</td><td>{items.map((item,i)=><div key={i}>{item.code} · {number(item.remainingBefore)} → {number(item.remainingAfter)}</div>)}</td><td>{row.status==='POSTED'&&row.totalCostSatang!==null?number(row.totalCostSatang/100):'ยังไม่บันทึก'}</td></tr>;
  })}</tbody></table></div>:<p className="muted">ยังไม่มีรายการจัดส่งที่เข้าประมวลผลสต๊อกในวันที่เลือก</p>}
  {pages>1&&<div className="actions" style={{marginTop:16}}>{page>1&&<Link className="button secondary" href={pageLink(page-1)}>ก่อนหน้า</Link>}<span>หน้า {page} / {pages}</span>{page<pages&&<Link className="button secondary" href={pageLink(page+1)}>ถัดไป</Link>}</div>}
 </section>;
}
