import Link from 'next/link';
import {StockSearch} from './stock-search';
import {requireAdminPage} from '@/lib/auth';
import {employeeStock} from '@/lib/employee-stock';
import {EmployeeNav} from '../employee-nav';
const number=(value:number|null)=>value===null?'รอตรวจสอบ':value.toLocaleString('th-TH',{maximumFractionDigits:3});
export default async function EmployeeStockPage({searchParams}:{searchParams:Promise<{q?:string;status?:string}>}){
 await requireAdminPage(['employee']);
 const input=await searchParams,q=(input.q??'').trim().slice(0,100),status=['available','empty','unknown'].includes(input.status??'')?input.status!:'all';
 const data=await employeeStock(),search=q.normalize('NFKC').toUpperCase();
 const rows=data.rows.filter(p=>(!search||(p.code+' '+(p.name??'')).normalize('NFKC').toUpperCase().includes(search))&&(status==='all'||status==='available'&&p.available!==null&&p.available>0||status==='empty'&&p.available!==null&&p.available<=0||status==='unknown'&&p.available===null));
 const rank=(p:typeof rows[number])=>{const code=p.code.normalize('NFKC').toUpperCase(),name=(p.name??'').normalize('NFKC').toUpperCase();return code===search?0:code.startsWith(search)?1:name.startsWith(search)?2:code.includes(search)?3:4;};
 if(search)rows.sort((a,b)=>rank(a)-rank(b));
 const counts={all:data.rows.length,available:data.rows.filter(p=>p.available!==null&&p.available>0).length,empty:data.rows.filter(p=>p.available!==null&&p.available<=0).length};
 return <main className="center-page performance-page"><section className="customer employee-orders-page employee-stock-page">
  <h1>สต๊อกสินค้า</h1><p className="muted">ตรวจสอบสินค้าพร้อมขายและราคาขาย · ดูข้อมูลเท่านั้น</p><EmployeeNav active="stock"/>
  <div className="employee-stock-summary">{[['all','สินค้าทั้งหมด'],['available','พร้อมขาย'],['empty','หมด / ติดลบ']].map(([key,label])=><Link href={'/my-performance/stock?status='+key} key={key}><span>{label}</span><strong>{counts[key as keyof typeof counts].toLocaleString('th-TH')}</strong></Link>)}</div>
  {!data.live&&<p className="notice">กำลังแสดงข้อมูลที่นำเข้าไว้ กรุณาดูเวลาอัปเดตก่อนแจ้งยอดให้ลูกค้า</p>}
  <p className="notice live">จำนวนพร้อมขายหักยอดสำรอง 20 กรัมต่อสินค้าแล้ว สินค้าที่เหลือ 20 กรัมหรือน้อยกว่าถือว่าหมดสำหรับขาย</p>
  <p className="muted small">{data.live?'ข้อมูลล่าสุด':'ข้อมูลสำรอง'}{data.readAt?' · '+data.readAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):' · ยังไม่มีข้อมูลสต๊อก'}</p>
  <StockSearch query={q} status={status}/>
  <div className="employee-order-list-heading"><h2>รายการสินค้า</h2><span>{rows.length.toLocaleString('th-TH')} รายการ</span></div>
  <div className="employee-stock-table"><table><thead><tr><th>สินค้า</th><th>ขายได้ (G)</th><th>ราคาขาย</th></tr></thead><tbody>{rows.map(p=><tr key={p.code}><td><strong>{p.code}</strong><small>{p.name||'—'}</small></td><td><strong>{number(p.available)}</strong></td><td>{p.prices.length?p.prices.map((price,i)=><div key={i}>{price.pack} · <b>{(price.priceSatang/100).toLocaleString('th-TH')}</b></div>):'—'}</td></tr>)}</tbody></table></div>
  {!rows.length&&<p className="commission-empty">{data.rows.length?'ไม่พบสินค้าที่ตรงกับตัวกรอง':'ยังไม่มีข้อมูลสินค้า'}</p>}
 </section></main>;
}
