'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {PlatformCustomerRow} from '@/lib/platform-customer-data';
import './customer-dashboard.css';

const money=(satang:number)=> (satang/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท';
function compareCustomers(a:PlatformCustomerRow,b:PlatformCustomerRow,sort:string){
 if(sort==='profit'||sort==='profit-low'){
  if(a.profitSatang===null)return b.profitSatang===null?0:1;
  if(b.profitSatang===null)return -1;
  return sort==='profit'?b.profitSatang-a.profitSatang:a.profitSatang-b.profitSatang;
 }
 if(sort==='monthly-profit'){
  const first=a.monthlyProfitAverageSatang;
  const second=b.monthlyProfitAverageSatang;
  if(first===null)return second===null?0:1;
  if(second===null)return -1;
  return second-first;
 }
 if(sort==='sales')return b.orderedSatang-a.orderedSatang;
 if(sort==='amount')return b.purchasedSatang-a.purchasedSatang;
 if(sort==='least')return a.orderCount-b.orderCount;
 if(sort==='recent')return (b.lastOrderAt??'').localeCompare(a.lastOrderAt??'');
 return b.orderCount-a.orderCount;
}
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่เคยสั่งซื้อ';
export function PlatformCustomerDashboard({rows,shopId}:{rows:PlatformCustomerRow[];shopId:string}){
 const [search,setSearch]=useState(''),[segment,setSegment]=useState('all'),[sort,setSort]=useState('orders'),[page,setPage]=useState(1);
 const query=search.trim().toLocaleLowerCase();
 const filtered=rows.filter(row=>[row.code,row.name,row.phone,row.address].some(value=>value?.toLocaleLowerCase().includes(query)))
  .filter(row=>segment==='all'||(segment==='repeat'&&row.orderCount>=2)||(segment==='inactive'&&row.inactive)||(segment==='never'&&row.orderCount===0))
  .sort((a,b)=>compareCustomers(a,b,sort));
 const pages=Math.max(1,Math.ceil(filtered.length/25)),current=Math.min(page,pages);
 const sales=rows.reduce((sum,row)=>({ordered:sum.ordered+row.orderedSatang,received:sum.received+row.purchasedSatang,pending:sum.pending+row.pendingSatang,unknown:sum.unknown+row.unknownAmountCount,profit:sum.profit+row.knownProfitSatang,missing:sum.missing+row.pendingCostCount}),{ordered:0,received:0,pending:0,unknown:0,profit:0,missing:0});
 const detail=(code:string)=>'/platform/shops/'+encodeURIComponent(shopId)+'?'+new URLSearchParams({view:'customers',customer:code});
 return <section className="customer-dashboard" aria-label="แดชบอร์ดข้อมูลลูกค้า">
  <h2>แดชบอร์ดข้อมูลลูกค้า</h2><p className="muted">ประวัติสะสมทั้งหมดของร้านที่เลือก · ใช้เกณฑ์เดียวกับ CRM</p>
  <div className="customer-kpis">
   <article className="card"><span>ลูกค้าทั้งหมด</span><strong>{rows.length.toLocaleString('th-TH')}</strong><span>คน</span></article>
   <article className="card"><span>ลูกค้าที่เคยสั่งซื้อ</span><strong>{rows.filter(row=>row.orderCount>0).length.toLocaleString('th-TH')}</strong><span>คน</span></article>
   <article className="card"><span>ลูกค้าสั่งตั้งแต่ 2 ครั้ง</span><strong>{rows.filter(row=>row.orderCount>=2).length.toLocaleString('th-TH')}</strong><span>คน</span></article>
   <article className="card"><span>ไม่ได้สั่งซื้อ 90 วันขึ้นไป</span><strong>{rows.filter(row=>row.inactive).length.toLocaleString('th-TH')}</strong><span>คน</span></article>
  </div>
  <div className="customer-kpis customer-sales" aria-label="ยอดขายจากลูกค้าทั้งหมดของร้าน">
   <article className="card"><span>ยอดขายรวมของลูกค้า</span><strong>{money(sales.ordered)}</strong><small>รวมโอนและ COD ที่บันทึกยอดแล้ว</small>{sales.unknown>0&&<p className="notice">ยังไม่ทราบยอด {sales.unknown} ออเดอร์</p>}</article>
   <article className="card"><span>รับเงินสำเร็จ</span><strong>{money(sales.received)}</strong><small>จากออเดอร์ลูกค้าชุดเดียวกัน</small></article>
   <article className="card"><span>ยอดรอรับเงิน</span><strong>{money(sales.pending)}</strong><small>จากออเดอร์ลูกค้าชุดเดียวกัน</small></article>
   <article className="card"><span>กำไรหลังต้นทุนสินค้า</span><strong>{sales.missing?'รอต้นทุนสินค้า':money(sales.profit)}</strong>{sales.missing>0&&<small>กำไรส่วนที่มีต้นทุนแล้ว {money(sales.profit)} · รอต้นทุน {sales.missing} ออเดอร์</small>}</article>
  </div>
  <section className="card"><h3>ลูกค้าซื้อบ่อย 10 อันดับ</h3><div className="customer-ranking">{rows.filter(row=>row.orderCount>0).slice(0,10).map(row=><Link key={row.code} href={detail(row.code)}><span>{row.name||row.code}</span><strong>{row.orderCount} ออเดอร์</strong><i style={{width:Math.max(1,row.orderCount/Math.max(1,rows[0]?.orderCount??0)*100)+'%'}}/></Link>)}</div>{!rows.some(row=>row.orderCount>0)&&<p>ยังไม่มีประวัติสั่งซื้อ</p>}</section>
  <section className="card"><h3>สำรวจข้อมูลลูกค้า</h3><div className="customer-filters">
   <label>ค้นหาลูกค้า<input value={search} onChange={event=>{setSearch(event.target.value);setPage(1)}} placeholder="ชื่อ เบอร์โทร รหัส หรือที่อยู่"/></label>
   <label>กลุ่มลูกค้า<select value={segment} onChange={event=>{setSegment(event.target.value);setPage(1)}}><option value="all">ทุกคน</option><option value="repeat">สั่งตั้งแต่ 2 ครั้ง</option><option value="inactive">ไม่ได้สั่งซื้อ 90 วันขึ้นไป</option><option value="never">ยังไม่มีออเดอร์ที่นับยอด</option></select></label>
   <label>เรียงตาม<select value={sort} onChange={event=>{setSort(event.target.value);setPage(1)}}><option value="orders">สั่งบ่อยที่สุด</option><option value="least">สั่งน้อยที่สุด</option><option value="sales">ยอดขายสูงสุด</option><option value="amount">ยอดรับเงินสูงสุด</option><option value="profit">กำไรสูงสุด</option><option value="profit-low">กำไรต่ำสุด</option><option value="monthly-profit">กำไรเฉลี่ยต่อเดือนสูงสุด</option><option value="recent">สั่งซื้อล่าสุด</option></select></label>
  </div><p role="status">พบ {filtered.length.toLocaleString('th-TH')} คน · หน้า {current} / {pages}</p>
  <div className="customer-list">{filtered.slice((current-1)*25,current*25).map(row=><article key={row.code} className="customer-entry"><h4><Link href={detail(row.code)}>{row.name||row.code}</Link></h4><p>{row.code} · {row.phone||'ไม่มีเบอร์โทร'}</p><p>{row.address||'ไม่มีที่อยู่'}{row.addressSource&&<small className="muted"> · จาก{row.addressSource}</small>}</p><dl><div><dt>ออเดอร์</dt><dd>{row.orderCount} ครั้ง</dd></div><div><dt>ยอดขายรวม</dt><dd>{money(row.orderedSatang)}</dd></div><div><dt>ยอดรอรับเงิน</dt><dd>{money(row.pendingSatang)}</dd></div><div><dt>รับเงินสำเร็จ</dt><dd>{money(row.purchasedSatang)}</dd></div><div><dt>กำไรหลังต้นทุนสินค้า</dt><dd>{row.profitSatang===null?'รอต้นทุนสินค้า':money(row.profitSatang)}</dd></div><div><dt>กำไรเฉลี่ยต่อเดือน</dt><dd>{row.monthlyProfitAverageSatang===null?'รอต้นทุนสินค้า':money(row.monthlyProfitAverageSatang)}</dd></div><div><dt>สั่งซื้อล่าสุด</dt><dd>{date(row.lastOrderAt)}</dd></div></dl>{row.inactive&&<p className="notice">ไม่ได้สั่งซื้อ {row.daysSinceLastOrder} วัน</p>}{row.unknownAmountCount>0&&<p>ยังไม่ทราบยอด {row.unknownAmountCount} ออเดอร์</p>}<Link className="button secondary" href={detail(row.code)}>ดูรายละเอียดลูกค้า</Link></article>)}</div>
  {!filtered.length&&<p>ไม่พบลูกค้าตามตัวกรอง</p>}<div className="actions"><button className="secondary" disabled={current<=1} onClick={()=>setPage(current-1)}>ก่อนหน้า</button><button className="secondary" disabled={current>=pages} onClick={()=>setPage(current+1)}>ถัดไป</button></div></section>
  <p className="muted small">ยอดขายรวมจากประวัติสะสมของลูกค้าที่มีรหัสในร้านนี้ รวมทั้งส่วนที่ยังรอรับเงิน ตัวกรองรายชื่อไม่เปลี่ยนยอดรวมด้านบน จำนวนออเดอร์ไม่นับรายการยกเลิก ถอน และตีกลับ ยอดรับเงินสำเร็จและกำไรใช้เฉพาะรายการที่เข้าเกณฑ์ซื้อสำเร็จ กำไรหักเฉพาะต้นทุนสินค้า กำไรเฉลี่ยต่อเดือนนับตั้งแต่เดือนแรกของลูกค้าถึงเดือนปัจจุบันรวมเดือนที่ไม่ซื้อ ลูกค้าที่ยังไม่เคยสั่งซื้อแสดงแยกจากกลุ่มหายไป 90 วัน</p>
 </section>;
}
