import {StoreBrand} from '@/app/store-brand';
import Link from 'next/link';
import {shopPath,requireShopAccount} from '@/lib/shop-session';
import {PopupDetails} from '@/app/popup-details';
import {ReadOnlyForms} from './read-only-forms';
import './shop-navigation.css';

export async function ShopWorkspaceNav({slug,role='owner'}:{slug:string;role?:string}){
 const context=await requireShopAccount(slug);
 const base=shopPath(slug);
 const links=[{href:base,label:'ภาพรวม'},{href:base+'/orders',label:'ออเดอร์'}];
 if(['owner','admin','manager'].includes(role))links.push({href:base+'/customers',label:'ลูกค้า'});
 if(['owner','admin','manager','viewer','employee','sales'].includes(role))links.push({href:base+'/sales',label:'ยอดขาย'});
 if(['owner','store'].includes(role))links.push(
  {href:base+'/stock',label:'สต๊อก'},
  {href:base+'/shipping',label:'อัปโหลดจัดส่ง'},
  {href:base+'/stock/returns',label:'รับคืนสินค้า'},
 );
 if(['owner','admin'].includes(role))links.push({href:base+'/accounting',label:'บัญชี'});
 if(role==='owner')links.push({href:base+'/branding',label:'ตั้งค่าแบรนด์ร้าน'},{href:base+'/receipts',label:'ใบเสร็จรับเงิน'},{href:base+'/users',label:'พนักงานและทีม'},{href:base+'/connections',label:'การเชื่อมต่อ'});
 const primary=[links[0],links[1],links.find(link=>link.href===base+'/stock')??links.find(link=>link.href===base+'/sales')].filter((link):link is {href:string;label:string}=>!!link);
 return <>
  <div className="brand"><StoreBrand fallback={context.shop.name}/></div>
  {context.readOnly&&<>
   <ReadOnlyForms/>
   <aside className="notice" role="status">
    <strong>มุมมองเจ้าของร้าน · {context.shop.name}</strong>
    <p>ผู้ดูแลแพลตฟอร์มกำลังดูข้อมูลร้านนี้ในโหมดดูข้อมูล</p>
    <form action={base+'/platform-exit'} method="post" data-platform-exit><button className="secondary">กลับผู้ดูแลแพลตฟอร์ม</button></form>
   </aside>
  </>}
  <nav className="actions shop-desktop-links" aria-label="เมนูร้าน">{links.map(link=><Link className="button secondary" href={link.href} key={link.href}>{link.label}</Link>)}</nav>
  <nav className="shop-mobile-tabs" aria-label="ทางลัดร้านบนมือถือ">
   {primary.map(link=><Link href={link.href} key={link.href}>{link.label}</Link>)}
   <PopupDetails summary="เมนู" title="เมนูร้าน">
    <nav className="shop-menu-links" aria-label="เมนูทั้งหมดของร้าน">{links.map(link=><a href={link.href} key={link.href}>{link.label}</a>)}</nav>
   </PopupDetails>
  </nav>
 </>;
}
