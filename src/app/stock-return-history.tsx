import Link from 'next/link';
import {db} from '@/lib/db';
import {dayStart,shiftDay} from '@/lib/sales-dates';

const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const quantity=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('th-TH',{maximumFractionDigits:3}):'—';

export async function StockReturnHistory({day,page:input}:{day:string;page?:string}){
 const range={gte:dayStart(day),lt:dayStart(shiftDay(day,1))},where={status:{in:['POSTED','NO_STOCK_CHANGE']},OR:[{receivedAt:range},{receivedAt:null,reportedAt:range}]};
 const total=await db.stockReturn.count({where}),pages=Math.max(1,Math.ceil(total/25)),requested=Number(input),page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,pages):1;
 const rows=await db.stockReturn.findMany({where,orderBy:[{receivedAt:{sort:'desc',nulls:'last'}},{reportedAt:'desc'},{id:'desc'}],skip:(page-1)*25,take:25});
 const dispatches=rows.length?await db.stockDispatch.findMany({where:{tracking:{in:rows.map(row=>row.tracking)}},select:{tracking:true,orderId:true,orderNumber:true}}):[];
 const pageLink=(n:number)=>'/admin/stock/history?'+new URLSearchParams({day,returnPage:String(n)})+'#return-history';
 return <section className="card" id="return-history" style={{minWidth:0,overflowWrap:'anywhere'}}>
  <div className="intro"><h2>ประวัติรับสินค้าตีกลับ</h2><span className="pill">{total.toLocaleString('th-TH')} รายการ</span></div>
  <p className="muted small">แสดงตามวันที่รับสินค้าคืน หากรายงานไม่ระบุวันรับ ใช้วันที่รายงาน ต้นทุนที่ปรับลดอ้างอิงยอดที่บันทึกตอนจัดส่งเดิม</p>
  {!rows.length?<p className="muted">ยังไม่มีรายการรับคืนที่ดำเนินการเสร็จในวันที่เลือก</p>:rows.map(row=>{
   const snapshot=object(row.historySnapshot),dispatch=dispatches.find(item=>item.tracking===row.tracking),orderId=row.orderId??dispatch?.orderId;
   const orderNumber=typeof snapshot.orderNumber==='string'?snapshot.orderNumber:dispatch?.orderNumber??'ออเดอร์เดิม';
   const items=Array.isArray(row.items)?row.items.map(object):[],posted=row.status==='POSTED';
   return <article key={row.id} style={{borderTop:'1px solid var(--border)',paddingTop:16,marginTop:16,minWidth:0}}>
    <div className="intro" style={{alignItems:'flex-start',marginBottom:8,flexWrap:'wrap'}}><div><strong>{orderId?<Link href={'/admin/orders/'+encodeURIComponent(orderId)+'/review'}>{orderNumber}</Link>:'ยังไม่พบออเดอร์เดิม'}</strong><p style={{margin:'4px 0'}}>เลขพัสดุ {row.tracking}</p><span className="muted small">{row.receivedAt?'รับคืน ':'วันที่รายงาน '}{(row.receivedAt??row.reportedAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</span></div><span className="pill">{posted?'เพิ่มสต๊อกคืนแล้ว':'ไม่มีสต๊อกที่ต้องเพิ่มคืน'}</span></div>
    <div className="form-grid"><div style={{minWidth:0}}>{items.length?items.map((item,index)=><p key={index} style={{margin:'4px 0'}}>{typeof item.code==='string'?item.code:'สินค้า'} · {quantity(typeof item.quantityMilliG==='number'?item.quantityMilliG/1000:null)} G{posted&&<span className="muted small"> · คงเหลือ {quantity(item.remainingBefore)} → {quantity(item.remainingAfter)} G</span>}</p>):<p className="muted">ไม่มีจำนวนสินค้าที่เพิ่มคืน</p>}</div><div style={{minWidth:0}}><p>ปรับลดต้นทุน: <strong>{posted&&row.totalCostSatang!==null?(-Math.abs(row.totalCostSatang)/100).toLocaleString('th-TH',{style:'currency',currency:'THB'}):'ไม่มีรายการปรับต้นทุน'}</strong></p>{row.processedAt&&<p className="muted small">บันทึกผล {row.processedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>}</div></div>
   </article>;
  })}
  {pages>1&&<nav className="actions" aria-label="หน้าประวัติรับสินค้าตีกลับ" style={{marginTop:18}}>{page>1&&<Link className="button secondary" href={pageLink(page-1)}>ก่อนหน้า</Link>}<span>หน้า {page} / {pages}</span>{page<pages&&<Link className="button secondary" href={pageLink(page+1)}>ถัดไป</Link>}</nav>}
 </section>;
}
