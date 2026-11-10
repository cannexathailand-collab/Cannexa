import {withShopWorkspace} from '@/lib/shop-workspace';
import {shopPath} from '@/lib/shop-session';
import {ShipmentUpload} from '@/app/admin/orders/upload/upload-form';
import {ShopWorkspaceNav} from '../workspace-nav';
export default async function Shipping({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params,{shop,account}=await withShopWorkspace(slug,async context=>context,['owner','store']);
 const path=shopPath(slug);
 return <main className="main"><h1>อัปโหลดจัดส่ง · {shop.name}</h1><ShopWorkspaceNav slug={slug} role={account.role}/><p>เลือกไฟล์ Excel หรือ CSV ตรวจรายการ แล้วระบุวันเวลาส่งมอบให้ขนส่งก่อนยืนยัน</p><ShipmentUpload ordersHref={path+'/orders'} endpoint={path+'/shipping/upload'}/></main>;
}
