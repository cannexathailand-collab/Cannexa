'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {analyzeBookedSales} from '@/lib/booked-sales';
import './daily-profit-ledger.css';

type Row=ReturnType<typeof analyzeBookedSales>['profitHistory'][number];
const money=(value:number)=>(value/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
const date=(value:string)=>new Date(value+'T00:00:00+07:00').toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium'});
export function DailyProfitLedger({rows,initialMonth,initialDay='',from,to,action,payment,seller,demo}:{rows:Row[];initialMonth:string;initialDay?:string;from:string;to:string;action:string;payment:string;seller:string;demo:boolean}){
 const [month,setMonth]=useState(initialMonth),[day,setDay]=useState(initialDay);
 const months=[...new Set([initialMonth,...rows.map(row=>row.day.slice(0,7))])].sort().reverse();
 const selected=rows.filter(row=>(!month||row.day.startsWith(month))&&(!day||row.day===day));
 const total=selected.reduce((sum,row)=>({sales:sum.sales+row.revenueSatang,cost:sum.cost+row.costSatang,profit:sum.profit+(row.profitSatang??0),missingCost:sum.missingCost+row.missingCostCount,unknown:sum.unknown+row.unknownAmountCount}),{sales:0,cost:0,profit:0,missingCost:0,unknown:0});
 const href=(day:string)=>action+'/profit/'+encodeURIComponent(day)+'?'+new URLSearchParams({payment,seller,from,to,ledgerMonth:month,ledgerDay:day,...(demo?{demo:'1'}:{})});
 return <section className="card daily-profit-ledger" aria-label="บัญชีกำไรรายวัน">
  <header><div><h2>บัญชีกำไรรายวัน</h2><p>หนึ่งรายการต่อวันปิดรอบ · กำไรหลังหักต้นทุนสินค้า</p></div><div className="profit-ledger-filters"><label>วันปิดรอบ<input type="date" aria-label="วันปิดรอบ" value={day} onChange={event=>{setDay(event.target.value);setMonth('')}}/></label><label>เดือนที่ต้องการดู<select aria-label="เดือนที่ต้องการดู" value={month} onChange={event=>{setMonth(event.target.value);setDay('')}}><option value="">ทุกเดือน</option>{months.map(value=><option key={value} value={value}>{new Date(value+'-01T00:00:00+07:00').toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',month:'long',year:'numeric'})}</option>)}</select></label></div></header>
  <div className="table-wrap"><table><thead><tr><th>วันที่ปิดรอบ</th><th>ออเดอร์</th><th>ยอดขาย</th><th>ต้นทุนสินค้า</th><th>กำไร</th><th>สถานะข้อมูล</th><th>รายละเอียด</th></tr></thead><tbody>{selected.map(row=><tr key={row.day} data-profit-day={row.day}><td data-label="วันปิดรอบ"><Link href={href(row.day)}>{date(row.day)}</Link></td><td data-label="ออเดอร์">{row.count}</td><td data-label="ยอดขาย">{money(row.revenueSatang)}</td><td data-label="ต้นทุนสินค้า">{row.missingCostCount?'ข้อมูลไม่ครบ':money(row.costSatang)}</td><td data-label="กำไร" className={row.profitSatang!==null&&row.profitSatang<0?'profit-negative':'profit-positive'}>{row.profitSatang===null?'รอข้อมูล':money(row.profitSatang)}</td><td data-label="สถานะข้อมูล"><span className={'profit-status '+(row.missingCostCount||row.unknownAmountCount?'incomplete':row.estimatedCostCount||row.isOpen?'estimated':'complete')}>{row.missingCostCount||row.unknownAmountCount?'ข้อมูลไม่ครบ':row.estimatedCostCount?'ต้นทุนประมาณการ':'ต้นทุนบันทึกแล้ว'}</span>{row.isOpen&&<small>รอบยังไม่ปิด</small>}{row.missingCostCount>0&&<small>รอต้นทุน {row.missingCostCount} ออเดอร์</small>}{row.unknownAmountCount>0&&<small>ไม่ทราบยอด {row.unknownAmountCount} ออเดอร์</small>}</td><td data-label="รายละเอียด"><Link className="button secondary" href={href(row.day)}>ดูรายละเอียด</Link></td></tr>)}</tbody><tfoot><tr><th colSpan={2}>รวม {selected.length} วัน</th><td data-label="รวมยอดขาย">{money(total.sales)}</td><td data-label="รวมต้นทุนสินค้า">{total.missingCost?'ข้อมูลไม่ครบ':money(total.cost)}</td><td data-label="รวมกำไร">{total.missingCost||total.unknown?'รอข้อมูล':money(total.profit)}</td><td colSpan={2}>{day||month||'ทุกเดือน'}</td></tr></tfoot></table></div>
  {!selected.length&&<p>ไม่พบรอบตามวันที่เลือก</p>}
  <p className="profit-ledger-note">อ้างอิงข้อมูลออเดอร์และต้นทุนที่บันทึกในระบบ ยอดย้อนหลังอัปเดตตามข้อมูลล่าสุด รวมออเดอร์โอนและ COD ในรอบเดียวกัน ค่าส่งและค่าใช้จ่ายอื่นบันทึกแยกในบัญชี</p>
 </section>;
}
