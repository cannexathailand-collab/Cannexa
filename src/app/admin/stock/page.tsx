import {requireAdminPage} from '@/lib/auth';
import {approvers} from '@/lib/accounts';
import {db} from '@/lib/db';

export default async function Stock({searchParams}:{searchParams:Promise<{q?:string}>}){
 await requireAdminPage(approvers);
 const q=((await searchParams).q??'').trim().slice(0,100);
 const products=await db.stockProduct.findMany({where:q?{OR:[{code:{contains:q,mode:'insensitive'}},{name:{contains:q,mode:'insensitive'}}]}:{},orderBy:[{sourceRow:'asc'},{code:'asc'}]});
 const total=await db.stockProduct.count();
 return <><div className="intro"><div><div className="eyebrow">บัญชี / สต๊อก</div><h1>สต๊อกสินค้า</h1><p className="muted">รหัสสินค้า ชื่อสินค้า จำนวนรับ และต้นทุนจากสต็อกร้านออนไลน์</p></div><span className="pill">{total} รายการ</span></div>
 <section className="card"><form action="/admin/stock" method="get"><label>ค้นหาสินค้า<input name="q" defaultValue={q} placeholder="รหัสหรือชื่อสินค้า" maxLength={100}/></label><button type="submit">ค้นหา</button></form></section>
 <section className="card"><h2>รายการสินค้า</h2>{products.length?<><p className="muted small">ข้อมูลจากชีต {products[0].sourceSheet} · นำเข้าล่าสุด {products[0].importedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p><div className="table-wrap"><table><thead><tr><th>รหัสสินค้า</th><th>สินค้า</th><th>จำนวนรับ</th><th>ต้นทุน (บาท)</th></tr></thead><tbody>{products.map(product=><tr key={product.id}><td><strong>{product.code}</strong></td><td>{product.name??<span className="muted">ยังไม่ระบุชื่อ</span>}</td><td>{product.receivedQuantity===null?<span className="muted">ยังไม่ระบุจำนวน</span>:product.receivedQuantity.toNumber().toLocaleString("th-TH",{maximumFractionDigits:3})}</td><td>{product.costSatang===null?<span className="muted">ยังไม่ระบุต้นทุน</span>:(product.costSatang/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>)}</tbody></table></div></>:<p className="muted">{q?'ไม่พบสินค้าที่ค้นหา':'ยังไม่มีรายการสินค้า'}</p>}</section></>;
}




