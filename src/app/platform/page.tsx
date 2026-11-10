import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {shopPath} from '@/lib/shop-session';
import {requirePlatformAdministrator,platformShopData} from '@/lib/platform-shops';
export default async function Platform({searchParams}:{searchParams:Promise<{shop?:string;status?:string}>}){
 let actor;try{actor=await requirePlatformAdministrator()}catch{redirect('/admin')}
 const {shop:id,status}=await searchParams;
 const shops=await db.platformShop.findMany({orderBy:{createdAt:'asc'}});
 const selected=id?await platformShopData(actor.username,id).catch(()=>null):null;
 return <main className="main"><div className="intro"><div><h1>ผู้ดูแลแพลตฟอร์ม</h1><p>จัดการร้านค้าและดูข้อมูลแยกร้าน</p></div><Link className="button secondary" href="/admin/executive">กลับร้าน Cannexa</Link></div>
 {status==='created'&&<p role="status">สร้างพื้นที่ข้อมูลร้านและบัญชีเจ้าของร้านแล้ว</p>}
 {status==='error'&&<p role="alert" className="notice">สร้างร้านไม่สำเร็จ กรุณาตรวจชื่อร้าน รหัสร้านที่ไม่ซ้ำ และรหัสผ่านอย่างน้อย 8 ตัวอักษร</p>}
 <section className="card"><h2>ร้านค้าทั้งหมด</h2><div className="table-wrap"><table><thead><tr><th>ร้านค้า</th><th>รหัสร้าน</th><th>ข้อมูล</th></tr></thead><tbody>{shops.map(shop=><tr key={shop.id}><td>{shop.name}</td><td>{shop.slug}</td><td><form action={'/api/platform/shops/'+encodeURIComponent(shop.id)+'/view'} method="post"><button>เปิดดูมุมมองเจ้าของร้าน</button></form> <Link href={'/platform/shops/'+encodeURIComponent(shop.id)}>รายงานร้าน</Link> <Link href={'/platform?shop='+encodeURIComponent(shop.id)}>สรุปข้อมูล</Link> · <Link href={shopPath(shop.slug)+'/login'}>เปิดหน้าล็อกอินร้าน</Link></td></tr>)}</tbody></table></div></section>
 {selected&&<section className="card"><h2>{selected.shop.name}</h2><p>ลูกค้า {selected.customers} คน · ออเดอร์ {selected.orders} รายการ · ผู้ใช้ {selected.users} บัญชี</p><p><Link className="button secondary" href={'/api/platform/export?shop='+encodeURIComponent(selected.shop.id)}>ส่งออกข้อมูลลูกค้าร้านนี้</Link> <Link className="button secondary" href={'/api/platform/export?kind=business&shop='+encodeURIComponent(selected.shop.id)}>ส่งออกข้อมูลธุรกิจร้านนี้</Link></p></section>}
 <section className="card"><h2>สร้างร้านค้า</h2><form action="/api/platform/shops" method="post" className="form-grid"><label>ชื่อร้าน<input name="name" required maxLength={100}/></label><label>รหัสร้าน<input name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]" placeholder="my-shop"/></label><label>ชื่อผู้ใช้เจ้าของร้าน<input name="ownerUsername" required pattern="[a-z0-9._\-]{3,64}" autoComplete="off"/></label><label>รหัสผ่านเจ้าของร้าน<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={256}/></label><div><button>สร้างพื้นที่ข้อมูลร้าน</button></div></form><p className="muted">สร้างแล้วเปิดลิงก์เข้าสู่ระบบของร้านเพื่อดูข้อมูลเบื้องต้นได้ การขาย สต๊อก บัญชี และการเชื่อมต่อแยกร้านอยู่ระหว่างพัฒนา</p></section>
 <section className="card"><h2>ข้อมูลรวมทุกร้าน</h2><a className="button secondary" href="/api/platform/export">ส่งออกข้อมูลลูกค้าทุกร้าน</a> <a className="button secondary" href="/api/platform/export?kind=business">ส่งออกข้อมูลธุรกิจทุกร้าน</a></section>
 </main>;
}
