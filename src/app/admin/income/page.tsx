import Link from 'next/link';
import {AutoFilterForm} from '@/app/auto-filter-form';
import {approvers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {salesReport,type SalesFilters} from '@/lib/sales-report';
import {bangkokDay,dayStart} from '@/lib/sales-dates';

const money=(amount:number)=>(amount/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
type Filters=SalesFilters&{view?:string};

export default async function Income({searchParams}:{searchParams:Promise<Filters>}){
 await requireAdminPage(approvers);
 const input=await searchParams,today=bangkokDay(new Date());
 const filters=input.from||input.to||input.month?input:{...input,from:today,to:today};
 let data;
 try{data=await salesReport(filters);}catch(error){
  if(error instanceof Error&&error.message.startsWith('INVALID'))return <section className="notice">ช่วงวันที่ไม่ถูกต้อง <Link href="/admin/income">กลับหน้ารายรับ</Link></section>;
  throw error;
 }
 const {income,range}=data,demo=filters.demo==='1';
 const views={ALL:income.rows,TRANSFER:income.rows.filter(row=>row.method==='TRANSFER'),COD:income.rows.filter(row=>row.method==='COD'),UNMATCHED:income.rows.filter(row=>row.method==='COD'&&!row.orderId)};
 const showEntries=Object.hasOwn(views,input.view??'');
 const view=showEntries?input.view as keyof typeof views:'ALL';
 const labels={ALL:'รายรับทั้งหมด',TRANSFER:'รายรับจากยอดโอน',COD:'รายรับ COD ตามอีเมล',UNMATCHED:'รับเงินแล้ว · รอจับคู่ออเดอร์'};
 const query=new URLSearchParams({from:range.from,to:range.to,payment:data.payment,seller:data.seller,...(demo?{demo:'1'}:{})});
 const href=(selected:string)=>'/admin/income?'+new URLSearchParams({...Object.fromEntries(query),view:selected}).toString()+'#income-entries';
 const cards=[
  {view:'ALL',label:'รายรับรวม',amount:income.amountSatang,count:income.count},
  {view:'TRANSFER',label:'ยอดโอน',amount:income.transferSatang,count:income.count-income.codCount},
  {view:'COD',label:'COD รับเงินแล้ว',amount:income.codSatang,count:income.codCount}
 ];
 return <>
  <div className="intro"><div><div className="eyebrow">บัญชี</div><h1>รายรับ</h1><p>{range.from===today&&range.to===today?'วันนี้ · ':''}{dayStart(range.from).toLocaleDateString('th-TH',{dateStyle:'medium'})}{range.to!==range.from&&' ถึง '+dayStart(range.to).toLocaleDateString('th-TH',{dateStyle:'medium'})}</p></div><Link className="button secondary" href={'/admin/sales?'+query}>ดูยอดขาย</Link></div>
  {demo&&<p className="notice">ข้อมูลทดสอบ</p>}
  <details className="card"><summary>เปลี่ยนวันที่หรือผู้ขาย</summary><p>COD ใช้วันรับเงินตามอีเมล ส่วนยอดโอนใช้วันจัดส่งตามรายงานยอดโอนเดิม</p>
   <AutoFilterForm action="/admin/income">{demo&&<input type="hidden" name="demo" value="1"/>}
    <label>ตั้งแต่<input type="date" name="from" defaultValue={range.from} required/></label>
    <label>ถึง<input type="date" name="to" defaultValue={range.to} required/></label>
    <label>ประเภท<select name="payment" defaultValue={data.payment}><option value="">ทั้งหมด</option><option value="TRANSFER">โอน</option><option value="COD">COD</option></select></label>
    <label>ผู้ขาย<select name="seller" defaultValue={data.seller}><option value="">ทั้งหมด</option>{data.sellerOptions.map(seller=><option key={seller}>{seller}</option>)}</select></label>
   </AutoFilterForm>
  </details>
  <section className="income-summary" aria-label="สรุปรายรับ">{cards.map(card=><Link className="card stat" href={href(card.view)} key={card.view}><span>{card.label}</span><strong>{money(card.amount)}</strong><span>{card.count.toLocaleString('th-TH')} รายการ</span><small>ดูรายการ →</small></Link>)}</section>
  {income.unmatchedCount>0&&<p className="notice"><Link href={href('UNMATCHED')}>รับเงินแล้ว · รอจับคู่ออเดอร์ {income.unmatchedCount.toLocaleString('th-TH')} รายการ →</Link></p>}
  {showEntries?<section className="card" id="income-entries"><div className="intro"><h2>{labels[view]}</h2><Link href={'/admin/income?'+query}>ปิดรายการ</Link></div><p>พบ {views[view].length.toLocaleString('th-TH')} รายการ</p>
   {view==='UNMATCHED'&&<p className="notice">รายการรับเงินเก็บค้างไว้เพื่อจับคู่ออเดอร์เมื่อข้อมูลเข้าครบ โดยคงวันที่รับเงินเดิม</p>}
   <div className="table-wrap"><table><thead><tr><th>วันที่อ้างอิงรายรับ</th><th>ประเภท</th><th>ออเดอร์ / ผู้ขาย</th><th>เลขพัสดุ</th><th>รายรับ</th></tr></thead><tbody>{views[view].map(row=><tr key={row.id}><td>{row.date.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</td><td>{row.method==='COD'?'COD รับเงินตามรายงานอีเมล':'โอน'}</td><td>{row.orderId&&!demo?<Link href={'/admin/orders/list/'+encodeURIComponent(row.orderId)}>{row.orderNumber}</Link>:row.orderNumber??'รับเงินแล้ว · รอจับคู่ออเดอร์'} · {row.seller??'ยังไม่ระบุผู้ขาย'}</td><td>{row.tracking??'—'}</td><td>{money(row.amountSatang)}</td></tr>)}</tbody></table></div>
  </section>:<p className="muted">กดยอดที่ต้องการเพื่อดูรายการ</p>}
 </>;
}
