import Link from 'next/link';
import {shopPath,requireShopAccount} from '@/lib/shop-session';
import {ReadOnlyForms} from './read-only-forms';
export async function ShopWorkspaceNav({slug,role='owner'}:{slug:string;role?:string}){
 const context=await requireShopAccount(slug);
 const base=shopPath(slug);
 return <>{context.readOnly&&<><ReadOnlyForms/><aside className="notice" role="status"><strong>มุมมองเจ้าของร้าน · {context.shop.name}</strong><p>ผู้ดูแลแพลตฟอร์มกำลังดูข้อมูลร้านนี้ในโหมดดูข้อมูล</p><form action={base+'/platform-exit'} method="post" data-platform-exit><button className="secondary">กลับผู้ดูแลแพลตฟอร์ม</button></form></aside></>}<nav className="actions" aria-label="เมนูร้าน"><Link className="button secondary" href={base}>ภาพรวม</Link><Link className="button secondary" href={base+'/orders'}>ออเดอร์</Link>{['owner','admin','manager'].includes(role)&&<Link className="button secondary" href={base+'/customers'}>ลูกค้า</Link>}{['owner','admin','manager','viewer','employee','sales'].includes(role)&&<Link className="button secondary" href={base+'/sales'}>ยอดขาย</Link>}{['owner','store'].includes(role)&&<><Link className="button secondary" href={base+'/stock'}>สต๊อก</Link><Link className="button secondary" href={base+'/shipping'}>อัปโหลดจัดส่ง</Link></>}{['owner','admin'].includes(role)&&<Link className="button secondary" href={base+'/accounting'}>บัญชี</Link>}{role==='owner'&&<><Link className="button secondary" href={base+'/users'}>พนักงานและทีม</Link><Link className="button secondary" href={base+'/connections'}>การเชื่อมต่อ</Link></>}</nav></>;
}
