import {employeeLanguage} from '@/lib/employee-language-server';
import {sortStockPackages} from '@/lib/stock-price-columns';
import {employeeRoles} from '@/lib/accounts';
import Link from 'next/link';
import {after} from 'next/server';
import {syncEmployeeStock} from '@/lib/employee-stock-sync';
import {StockSearch} from './stock-search';
import {requireAdminPage} from '@/lib/auth';
import {employeeStock} from '@/lib/employee-stock';
import {EmployeeNav} from '../employee-nav';
const number=(value:number|null)=>value===null?'รอตรวจสอบ':value.toLocaleString('th-TH',{maximumFractionDigits:3});
export default async function EmployeeStockPage({searchParams}:{searchParams:Promise<{q?:string;status?:string}>}){
 const {t,locale,language}=await employeeLanguage();
 const number=(value:number|null)=>value===null?t('รอตรวจสอบ'):value.toLocaleString(locale,{maximumFractionDigits:3});

 await requireAdminPage(employeeRoles);
 after(()=>syncEmployeeStock().catch(()=>{}));
 const input=await searchParams,q=(input.q??'').trim().slice(0,100),status=['available','empty','unknown'].includes(input.status??'')?input.status!:'all';
 const data=await employeeStock(),search=q.normalize('NFKC').toUpperCase();
 const rows=data.rows.filter(p=>(!search||(p.code+' '+(p.name??'')).normalize('NFKC').toUpperCase().includes(search))&&(status==='all'||status==='available'&&p.available!==null&&p.available>0||status==='empty'&&p.available!==null&&p.available<=0||status==='unknown'&&p.available===null));
 const rank=(p:typeof rows[number])=>{const code=p.code.normalize('NFKC').toUpperCase(),name=(p.name??'').normalize('NFKC').toUpperCase();return code===search?0:code.startsWith(search)?1:name.startsWith(search)?2:code.includes(search)?3:4;};
 if(search)rows.sort((a,b)=>rank(a)-rank(b));
 const packs=sortStockPackages([...new Set(data.rows.flatMap(product=>product.prices.map(price=>price.pack)))]);
 const counts={all:data.rows.length,available:data.rows.filter(p=>p.available!==null&&p.available>0).length,empty:data.rows.filter(p=>p.available!==null&&p.available<=0).length};
 return <main className="center-page performance-page"><section className="customer employee-orders-page employee-stock-page">
  <h1>{t("สต๊อกสินค้า")}</h1><p className="muted">{t("ตรวจสอบสินค้าพร้อมขายและราคาขาย · ดูข้อมูลเท่านั้น")}</p><EmployeeNav active="stock"/>
  <div className="employee-stock-summary">{[['all','สินค้าทั้งหมด'],['available','พร้อมขาย'],['empty','หมด / ติดลบ']].map(([key,label])=><Link href={'/my-performance/stock?status='+key} key={key}><span>{label}</span><strong>{counts[key as keyof typeof counts].toLocaleString(locale)}</strong></Link>)}</div>
  {!data.live&&<p className="notice">{t("แสดงข้อมูลจากฐานข้อมูลระบบ อัปเดตสต๊อกเบื้องหลังทุก 1 นาที กรุณาดูเวลาอัปเดตล่าสุด")}</p>}
  {data.readAt&&Date.now()-data.readAt.getTime()>180000&&<p className="notice" role="status">{t("ข้อมูลยังไม่อัปเดตในช่วง 3 นาทีที่ผ่านมา กรุณาตรวจสอบยอดกับผู้ดูแลก่อนยืนยันสินค้า")}</p>}
  <p className="notice live">{t("จำนวนพร้อมขายหักยอดสำรอง 20 กรัมต่อสินค้าแล้ว สินค้าที่เหลือ 20 กรัมหรือน้อยกว่าถือว่าหมดสำหรับขาย")}</p>
  <p className="muted small">{t('ข้อมูลระบบ')}{data.readAt?' · '+data.readAt.toLocaleString(locale,{timeZone:'Asia/Bangkok'}):t(' · ยังไม่มีข้อมูลสต๊อก')}</p>
  <StockSearch query={q} status={status} catalog={data.rows.map(({code,name,available})=>({code,name,available}))}/>
  <div className="employee-order-list-heading"><h2>{t("รายการสินค้า")}</h2><span>{rows.length.toLocaleString(locale)} {t(" รายการ")}</span></div>
  <div className="employee-stock-table employee-stock-compact"><table><caption>{t("ราคาขายแยกตามขนาดบรรจุ (บาท) · เลื่อนซ้าย–ขวาเพื่อดูราคาทุกขนาด")}</caption><thead><tr><th scope="col">{t("สินค้า")}</th><th scope="col">{t("ขายได้ (G)")}</th>{packs.map(pack=><th scope="col" key={pack}>{pack}</th>)}</tr></thead><tbody>{rows.map(product=><tr key={product.code}><th scope="row"><strong>{product.code}</strong><small title={product.name??undefined}>{product.name||'—'}</small></th><td className={product.available===0?"employee-stock-sold-out":undefined}><strong>{product.available===0?t("หมด"):number(product.available)}</strong></td>{packs.map(pack=>{const price=product.prices.find(price=>price.pack===pack);return <td key={pack}>{price?(price.priceSatang/100).toLocaleString(locale):'—'}</td>;})}</tr>)}</tbody></table></div>
  {!rows.length&&<p className="commission-empty">{data.rows.length?t('ไม่พบสินค้าที่ตรงกับตัวกรอง'):t('ยังไม่มีข้อมูลสินค้า')}</p>}
 </section></main>;
}
