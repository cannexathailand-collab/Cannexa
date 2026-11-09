import {hasManualStockReceipt} from '@/lib/stock-return-receipt';
import Link from 'next/link';
import {db} from '@/lib/db';
import {orderStockItems} from '@/lib/order-stock-items';

const itemsFrom=(value:unknown)=>Array.isArray(value)?value.flatMap(raw=>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return [];
 const item=raw as Record<string,unknown>;
 return typeof item.code==='string'?[{code:item.code,name:typeof item.name==='string'?item.name:null,grams:typeof item.quantityMilliG==='number'&&Number.isFinite(item.quantityMilliG)?item.quantityMilliG/1000:null}]:[];
}):[];
const when=(date:Date)=>date.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});

export async function StockReturnStatus({page:input,reviewPage=1,result,returnPath='/admin/stock/review',orderBaseHref='/admin/orders/',orderSuffix='/review'}:{page?:string;reviewPage?:number;result?:string;returnPath?:'/admin/stock/review'|'/admin/stock/returns';orderBaseHref?:string;orderSuffix?:string}){
 const where={status:{notIn:['POSTED','NO_STOCK_CHANGE']}},total=await db.stockReturn.count({where}),pages=Math.max(1,Math.ceil(total/25));
 const requested=Number(input),page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,pages):1;
 const [rows,emailReviews]=await Promise.all([
  db.stockReturn.findMany({where,orderBy:[{reportedAt:'desc'},{id:'desc'}],skip:(page-1)*25,take:25}),
  db.auditLog.findMany({where:{action:'STOCK_RETURN_EMAIL_REVIEW'},orderBy:[{createdAt:'desc'},{id:'desc'}],take:10,select:{id:true,createdAt:true,details:true}})
 ]);
 const tracking=rows.map(row=>row.tracking);
 const [shipments,dispatches]=tracking.length?await Promise.all([
  db.shipment.findMany({where:{tracking:{in:tracking}},select:{tracking:true,orderId:true,recipient:true}}),
  db.stockDispatch.findMany({where:{OR:[{tracking:{in:tracking}},{candidateTracking:{in:tracking}}]},select:{orderId:true,orderNumber:true,tracking:true,candidateTracking:true,items:true}})
 ]):[[],[]];
 const ids=[...new Set([...rows.flatMap(row=>row.orderId?[row.orderId]:[]),...shipments.flatMap(row=>row.orderId?[row.orderId]:[]),...dispatches.map(row=>row.orderId)])];
 const orders=ids.length?await db.orderIntake.findMany({where:{id:{in:ids}},select:{id:true,orderNumber:true,recipient:true,sellerUsername:true,sellerCode:true,affiliateId:true,rawText:true}}):[];
 const affiliateIds=[...new Set(orders.flatMap(order=>order.affiliateId?[order.affiliateId]:[]))];
 const sellers=affiliateIds.length?await db.userAccount.findMany({where:{affiliateId:{in:affiliateIds},active:true},select:{affiliateId:true,username:true}}):[];
 const notices:Record<string,string>={posted:'รับสินค้าคืนและปรับลดต้นทุนเดิมแล้ว',unchanged:'ตรวจแล้วไม่มีสต๊อกที่ต้องเพิ่มคืน รายการอยู่ในประวัติ',pending:'บันทึกคำสั่งแล้ว ตรวจสถานะและสาเหตุของรายการด้านล่าง',failed:'ยังยืนยันผลรับคืนไม่ได้ ตรวจสถานะล่าสุดแล้วลองอีกครั้ง'};
 const pageLink=(n:number)=>returnPath+'?'+new URLSearchParams({page:String(reviewPage),returnPage:String(n)})+'#stock-returns';
 return <section className="card" id="stock-returns" style={{minWidth:0,overflowWrap:'anywhere'}}>
  <div className="intro"><div><h2>รับสินค้าตีกลับ</h2><p className="muted small">เพิ่มสต๊อกเมื่อได้รับสินค้าคืนครบแล้ว โดยอ้างอิงออเดอร์และเลขพัสดุเดิม</p></div><span className="pill">รอดำเนินการ {total.toLocaleString('th-TH')} รายการ</span></div>
  {result&&notices[result]&&<p className={'notice'+(['posted','unchanged'].includes(result)?' live':'')} role="status">{notices[result]}</p>}
  {!rows.length?<p className="muted">ไม่มีรายการตีกลับที่รอดำเนินการ</p>:rows.map(row=>{
   const received=hasManualStockReceipt(row.evidence);
   const shipment=shipments.find(item=>item.tracking===row.tracking),matchingDispatches=dispatches.filter(item=>item.tracking===row.tracking||item.candidateTracking===row.tracking);
   const linkedIds=[...new Set([row.orderId,shipment?.orderId,...matchingDispatches.map(item=>item.orderId)].filter((id):id is string=>!!id))];
   const orderId=linkedIds.length===1?linkedIds[0]:null,order=orders.find(item=>item.id===orderId),dispatch=orderId?matchingDispatches.find(item=>item.orderId===orderId):undefined;
   const sellerNames=sellers.filter(item=>item.affiliateId===order?.affiliateId).map(item=>item.username),seller=sellerNames.length===1?sellerNames[0]:order?.sellerUsername??order?.sellerCode??'ยังไม่ทราบผู้ขาย';
   const stored=itemsFrom(row.items),original=itemsFrom(dispatch?.items),items=stored.length?stored:original.length?original:itemsFrom(orderStockItems(order?.rawText??null).items);
   const issues=Array.isArray(row.issues)?row.issues.filter((issue):issue is string=>typeof issue==='string'):[];
   return <article key={row.id} style={{borderTop:'1px solid var(--border)',paddingTop:18,marginTop:18,minWidth:0}}>
    <div className="intro" style={{alignItems:'flex-start',marginBottom:8,flexWrap:'wrap'}}><div style={{minWidth:0}}><strong>{orderId?<Link href={orderBaseHref+encodeURIComponent(orderId)+orderSuffix}>{order?.orderNumber??dispatch?.orderNumber??'เปิดออเดอร์เดิม'}</Link>:'ยังไม่พบออเดอร์ที่ตรงกัน'}</strong><p style={{margin:'4px 0'}}>เลขพัสดุ {row.tracking}</p><span className="muted small">รายงาน {when(row.reportedAt)}</span></div><span className="pill warn">{received?'รับสินค้าคืนครบแล้ว · รอประมวลผล':'รอพนักงานยืนยันรับสินค้าคืนครบ'}</span></div>
    <div className="form-grid"><div style={{minWidth:0}}><p>ผู้รับเดิม: {order?.recipient??shipment?.recipient??'ยังไม่ทราบผู้รับ'}<br/>ผู้ขาย: {seller}</p><div>{items.length?items.map((item,index)=><p key={index} style={{margin:'4px 0'}}>{item.code}{item.name?' · '+item.name:''} · {item.grams===null?'ยังไม่ทราบจำนวน':item.grams.toLocaleString('th-TH',{maximumFractionDigits:3})+' G'}</p>):<p className="muted">ยังไม่มีรายการสินค้าที่ตรวจสอบกับออเดอร์เดิมได้</p>}</div></div>
     <div style={{minWidth:0}}>{!orderId&&<p className="notice">{linkedIds.length>1?'ข้อมูลออเดอร์กับเลขพัสดุไม่ตรงกัน':'ยังจับคู่เลขพัสดุนี้กับออเดอร์เดิมไม่ได้'} ระบบจะยังไม่เพิ่มสต๊อก</p>}{issues.map((issue,index)=><p className="muted small" key={index}>{issue}</p>)}
      {!received?<form method="post" action="/api/admin/stock/returns"><input type="hidden" name="returnTo" value={returnPath}/><input type="hidden" name="tracking" value={row.tracking}/><input type="hidden" name="action" value="confirm"/><label style={{lineHeight:1.7}}><input type="checkbox" name="receivedAll" value="yes" required/> ได้รับพัสดุนี้และสินค้าคืนครบทุกชิ้นแล้ว</label><button>ยืนยันรับคืนครบ</button></form>:row.stage==='RECEIVED'?<form method="post" action="/api/admin/stock/returns"><input type="hidden" name="returnTo" value={returnPath}/><input type="hidden" name="tracking" value={row.tracking}/><button name="action" value="retry" className="secondary">ลองรับคืนอีกครั้ง</button></form>:<p className="notice">สถานะรับคืนยังไม่ชัดเจน ต้องตรวจสอบก่อน</p>}
     </div>
    </div>
   </article>;
  })}
  {pages>1&&<nav className="actions" aria-label="หน้ารายการรับสินค้าตีกลับ" style={{marginTop:18}}>{page>1&&<Link className="button secondary" href={pageLink(page-1)}>ก่อนหน้า</Link>}<span>หน้า {page} / {pages}</span>{page<pages&&<Link className="button secondary" href={pageLink(page+1)}>ถัดไป</Link>}</nav>}
  {emailReviews.length>0&&<div style={{borderTop:'1px solid var(--border)',paddingTop:18,marginTop:18,minWidth:0}}><h3>อีเมลตีกลับที่ต้องตรวจรายละเอียด</h3><p className="muted small">10 รายการล่าสุดที่ยังอ่านเลขพัสดุได้ไม่ชัดเจน กรุณาตรวจอีเมลต้นฉบับก่อนจับคู่กับออเดอร์</p>{emailReviews.map(entry=>{
   const details=entry.details&&typeof entry.details==='object'&&!Array.isArray(entry.details)?entry.details:{},reportedAt=typeof details.reportedAt==='string'?new Date(details.reportedAt):entry.createdAt;
   const issues=Array.isArray(details.issues)?details.issues.filter((issue):issue is string=>typeof issue==='string'):[];
   return <article key={entry.id} style={{marginTop:14,minWidth:0}}><strong>{typeof details.subject==='string'?details.subject:'อีเมลตีกลับ'}</strong><p className="muted small" style={{margin:'4px 0'}}>จาก {typeof details.sender==='string'?details.sender:'ไม่ระบุผู้ส่ง'} · {when(Number.isFinite(+reportedAt)?reportedAt:entry.createdAt)}</p>{issues.map((issue,index)=><p key={index} className="muted small" style={{margin:'4px 0'}}>{issue}</p>)}</article>;
  })}</div>}
 </section>;
}
