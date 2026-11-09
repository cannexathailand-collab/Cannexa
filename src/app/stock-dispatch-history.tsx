import Link from 'next/link';
import {db} from '@/lib/db';
import {loadOrderRoundSettings} from '@/lib/order-round-settings';
import {orderRoundBounds} from '@/lib/order-round';

export async function StockDispatchHistory({day,page:input,historyDay=day,orderLinks=true,orderBaseHref='/admin/orders/',orderSuffix='/review'}:{day:string;page?:string;historyDay?:string;orderLinks?:boolean;orderBaseHref?:string;orderSuffix?:string}){
 const settings=await loadOrderRoundSettings(),round=orderRoundBounds(day,settings.closeMinutes);
 const orders=await db.orderIntake.findMany({where:{eventAt:{gte:round.start,lt:round.end}},select:{id:true,recipient:true}});
 const where={orderId:{in:orders.map(order=>order.id)},status:{not:'EXCLUDED'}};
 const total=await db.stockDispatch.count({where}),pages=Math.max(1,Math.ceil(total/50)),requested=Number(input);
 const page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,pages):1;
 const rows=await db.stockDispatch.findMany({where,orderBy:[{processedAt:{sort:'desc',nulls:'last'}},{dispatchedAt:'desc'},{id:'desc'}],skip:(page-1)*50,take:50});
 const shipments=rows.length?await db.shipment.findMany({where:{orderId:{in:rows.map(row=>row.orderId)}},select:{orderId:true,recipient:true}}):[];
 const recipients=new Map(orders.map(order=>[order.id,order.recipient]));
 for(const shipment of shipments)if(shipment.orderId&&shipment.recipient.trim())recipients.set(shipment.orderId,shipment.recipient);
 const pageLink=(n:number)=>'/admin/stock/history?'+new URLSearchParams({day:historyDay,round:day,dispatchPage:String(n)})+'#dispatch-history';
 const number=(v:unknown)=>typeof v==='number'?v.toLocaleString('th-TH',{maximumFractionDigits:3}):'—';
 return <section className="card" id="dispatch-history">
  <div className="intro"><h2>รายการจัดส่งและตัดสต๊อก · รอบวันที่ {day}</h2><span className="pill">{total} ออเดอร์</span></div>
  <form method="get" className="actions"><input type="hidden" name="day" value={historyDay}/><label>รอบออเดอร์<input type="date" name="round" defaultValue={day} required/></label><button className="secondary">ดูรอบนี้</button></form>
  <p className="muted small">แยกตามรอบออเดอร์เดียวกับหน้ารายการออเดอร์ ตั้งแต่ {round.start.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})} ถึง {round.end.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})} พร้อมแสดงเวลาที่ตัดสต๊อกจริงของแต่ละรายการ</p>
  {rows.length?<div className="table-wrap"><table><thead><tr><th>วันที่ตัดสต๊อก / จัดส่ง</th><th>ผู้รับ / เลขพัสดุ</th><th>สถานะ</th><th>สินค้าและจำนวน (G)</th><th>คงเหลือก่อน → หลัง (G)</th><th>ต้นทุนที่บันทึก (บาท)</th></tr></thead><tbody>{rows.map(row=>{
   const recipient=recipients.get(row.orderId)?.trim()||'ยังไม่ระบุชื่อผู้รับ';
   const items=Array.isArray(row.items)?row.items as Record<string,any>[]:[];
   const status:Record<string,string>={POSTED:'ตัดสต๊อกและบันทึกต้นทุนแล้ว',HISTORY_SAVED:'บันทึกประวัติแล้ว รอตัดสต๊อก',PENDING:'รอประมวลผล',WAITING_COST:'รอต้นทุน',NEEDS_REVIEW:'รอตรวจสอบ'};
   return <tr key={row.id}><td>{row.processedAt?'ตัดสต๊อก '+row.processedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่ตัดสต๊อก'}{row.historySavedAt&&<div className="muted small">เก็บประวัติ {row.historySavedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</div>}<div className="muted small">จัดส่ง {row.dispatchedAt?.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</div></td><td>{orderLinks?<Link className="stock-history-order-link" href={orderBaseHref+encodeURIComponent(row.orderId)+orderSuffix} title={row.orderNumber}><strong>{recipient}</strong><span>{row.tracking??row.candidateTracking??'ยังไม่มีเลขพัสดุ'}</span></Link>:<><strong>{recipient}</strong><div>{row.tracking??row.candidateTracking??'ยังไม่มีเลขพัสดุ'}</div></>}</td><td>{status[row.status]??'รอตรวจสอบ'}</td><td>{items.map((item,i)=><div key={i}>{item.code} · {number(typeof item.quantityMilliG==='number'?item.quantityMilliG/1000:null)}{item.name&&' · '+item.name}</div>)}</td><td>{row.status==='POSTED'?items.map((item,i)=><div key={i}>{item.code} · {number(item.remainingBefore)} → {number(item.remainingAfter)}</div>):'ยังไม่ตัดสต๊อก'}</td><td>{row.status==='POSTED'&&row.totalCostSatang!==null?number(row.totalCostSatang/100):'ยังไม่บันทึก'}</td></tr>;
  })}</tbody></table></div>:<p className="muted">ยังไม่มีรายการจัดส่งที่เข้าประมวลผลสต๊อกในวันที่เลือก</p>}
  {pages>1&&<div className="actions" style={{marginTop:16}}>{page>1&&<Link className="button secondary" href={pageLink(page-1)}>ก่อนหน้า</Link>}<span>หน้า {page} / {pages}</span>{page<pages&&<Link className="button secondary" href={pageLink(page+1)}>ถัดไป</Link>}</div>}
 </section>;
}
