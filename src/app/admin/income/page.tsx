import Link from 'next/link';
import {AutoFilterForm} from '@/app/auto-filter-form';
import {approvers} from '@/lib/accounts';
import {requireAdminPage} from '@/lib/auth';
import {salesReport,type SalesFilters} from '@/lib/sales-report';
import {bangkokDay,dayStart} from '@/lib/sales-dates';

const money=(amount:number)=>(amount/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
const tableMoney=(amount:number)=>(amount/100).toLocaleString('th-TH',{maximumFractionDigits:2});
type Filters=SalesFilters&{view?:string;day?:string};

export default async function Income({searchParams}:{searchParams:Promise<Filters>}){
 await requireAdminPage(approvers);
 const input=await searchParams,today=bangkokDay(new Date());
 const filters=input.from||input.to||input.month?input:{...input,from:today.slice(0,7)+'-01',to:today};
 let data;
 try{data=await salesReport(filters);}catch(error){
  if(error instanceof Error&&error.message.startsWith('INVALID'))return <section className="notice">ช่วงวันที่ไม่ถูกต้อง <Link href="/admin/income">กลับหน้ารายรับ</Link></section>;
  throw error;
 }
 const {income,range}=data,demo=filters.demo==='1';
 const days=income.daily;
 const todayTotals=days.find(day=>day.day===today)??(await salesReport({...filters,from:today,to:today})).income.daily[0];
 const selectedDay=days.some(day=>day.day===input.day)?input.day!:null;
 const entries=selectedDay?income.rows.filter(row=>bangkokDay(row.date)===selectedDay):income.rows;
 const views={ALL:entries,TRANSFER:entries.filter(row=>row.method==='TRANSFER'),COD:entries.filter(row=>row.method==='COD'),UNMATCHED:entries.filter(row=>row.method==='COD'&&!row.orderId)};
 const showEntries=Object.hasOwn(views,input.view??'');
 const view=showEntries?input.view as keyof typeof views:'ALL';
 const labels={ALL:'รายรับทั้งหมด',TRANSFER:'รายรับจากยอดโอน',COD:'รายรับ COD ตามอีเมล',UNMATCHED:'รับเงินแล้ว · รอจับคู่ออเดอร์'};
 const query=new URLSearchParams({from:range.from,to:range.to,payment:data.payment,seller:data.seller,...(demo?{demo:'1'}:{})});
 const href=(selected:string)=>'/admin/income?'+new URLSearchParams({...Object.fromEntries(query),view:selected}).toString()+'#income-entries';
 const todayHref=(view:string)=>{const params=new URLSearchParams(query);if(today<range.from||today>range.to){params.set('from',today);params.set('to',today);}params.set('day',today);params.set('view',view);return '/admin/income?'+params.toString()+'#income-entries';};
 return <>
  <div className="intro"><div><div className="eyebrow">บัญชี</div><h1>รายรับ</h1><p>{range.from===today&&range.to===today?'วันนี้ · ':''}{dayStart(range.from).toLocaleDateString('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'})}{range.to!==range.from&&' ถึง '+dayStart(range.to).toLocaleDateString('th-TH',{dateStyle:'medium'})}</p></div><Link className="button secondary" href={'/admin/sales?'+query}>ดูยอดขาย</Link></div>
  {demo&&<p className="notice">ข้อมูลทดสอบ</p>}
  <section className="card income-today" aria-label="รายรับวันนี้"><h2>รายรับวันนี้</h2><Link className="income-today-total" href={todayHref('ALL')}>{money(todayTotals.transferSatang+todayTotals.codSatang)}</Link><div className="income-today-breakdown"><Link href={todayHref('TRANSFER')}><span>ยอดโอน</span><strong>{money(todayTotals.transferSatang)}</strong></Link><Link href={todayHref('COD')}><span>COD รับตามอีเมล</span><strong>{money(todayTotals.codSatang)}</strong></Link></div></section>
  <section className="card"><p>COD ใช้วันรับเงินตามอีเมล ส่วนยอดโอนใช้วันจัดส่งตามรายงานยอดโอนเดิม</p>
   <AutoFilterForm action="/admin/income">{demo&&<input type="hidden" name="demo" value="1"/>}
    <label>ตั้งแต่<input type="date" name="from" defaultValue={range.from} required/></label>
    <label>ถึง<input type="date" name="to" defaultValue={range.to} required/></label>
    <label>ประเภท<select name="payment" defaultValue={data.payment}><option value="">ทั้งหมด</option><option value="TRANSFER">โอน</option><option value="COD">COD</option></select></label>
    <label>ผู้ขาย<select name="seller" defaultValue={data.seller}><option value="">ทั้งหมด</option>{data.sellerOptions.map(seller=><option key={seller}>{seller}</option>)}</select></label>
   </AutoFilterForm>
  </section>
  <section className="card"><h2>รายรับแต่ละวัน <small className="muted">(บาท)</small></h2><div className="table-wrap"><table className="income-daily-table"><thead><tr><th>วันที่</th><th>โอน</th><th>COD รับแล้ว</th><th>รวม</th></tr></thead><tbody>{days.map(day=><tr key={day.day}><td><Link href={href('ALL').replace('#income-entries','&day='+day.day+'#income-entries')}>{dayStart(day.day).toLocaleDateString('th-TH',{day:'numeric',month:'short',timeZone:'Asia/Bangkok'})}{day.day===today?' · วันนี้':''}</Link><small className="order-meta">{day.count} รายการ</small></td><td>{tableMoney(day.transferSatang)}</td><td>{tableMoney(day.codSatang)}</td><td><strong>{tableMoney(day.transferSatang+day.codSatang)}</strong></td></tr>)}</tbody><tfoot><tr><th>รวม<small className="order-meta">{income.count} รายการ</small></th><td>{tableMoney(income.transferSatang)}</td><td>{tableMoney(income.codSatang)}</td><td><strong>{tableMoney(income.amountSatang)}</strong></td></tr></tfoot></table></div></section>
  {income.unmatchedCount>0&&<p className="small"><Link href={href('UNMATCHED')}>รับเงินแล้ว · รอจับคู่ออเดอร์ {income.unmatchedCount.toLocaleString('th-TH')} รายการ →</Link></p>}
  {showEntries?<section className="card" id="income-entries"><div className="intro"><h2>{labels[view]}{selectedDay?' · '+dayStart(selectedDay).toLocaleDateString('th-TH',{dateStyle:'medium'}):''}</h2><Link href={'/admin/income?'+query}>ปิดรายการ</Link></div><p>พบ {views[view].length.toLocaleString('th-TH')} รายการ</p>
   {view==='UNMATCHED'&&<p className="notice">รายการรับเงินเก็บค้างไว้เพื่อจับคู่ออเดอร์เมื่อข้อมูลเข้าครบ โดยคงวันที่รับเงินเดิม</p>}
   <div className="table-wrap"><table><thead><tr><th>วันที่อ้างอิงรายรับ</th><th>ประเภท</th><th>ออเดอร์ / ผู้ขาย</th><th>เลขพัสดุ</th><th>รายรับ</th></tr></thead><tbody>{views[view].map(row=><tr key={row.id}><td>{row.date.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</td><td>{row.method==='COD'?'COD รับเงินตามรายงานอีเมล':'โอน'}</td><td>{row.orderId&&!demo?<Link href={'/admin/orders/list/'+encodeURIComponent(row.orderId)}>{row.orderNumber}</Link>:row.orderNumber??'รับเงินแล้ว · รอจับคู่ออเดอร์'} · {row.seller??'ยังไม่ระบุผู้ขาย'}</td><td>{row.tracking??'—'}</td><td>{money(row.amountSatang)}</td></tr>)}</tbody></table></div>
  </section>:<p className="muted small">กดวันที่เพื่อดูออเดอร์ของวันนั้น</p>}
 </>;
}
