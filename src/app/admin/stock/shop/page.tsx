import Link from 'next/link';
import {requireAdminPage} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {loadCustomerCatalog} from '@/lib/customer-catalog';
import {loadShopCatalogSettings} from '@/lib/shop-catalog-settings';
import {ShopCatalogEditor} from './shop-catalog-editor';
export default async function ShopCatalogPage(){
 await requireAdminPage(managers);
 const [catalog,settings]=await Promise.all([loadCustomerCatalog(undefined,{merchandising:false}),loadShopCatalogSettings()]);
 return <><Link href="/admin/stock">← กลับรายการสินค้า</Link><h1>จัดหมวดหมู่หน้า Shop</h1><p>ตั้งชื่อหมวดหมู่และเลือกสินค้าแนะนำสำหรับร้านนี้ สินค้าขายดีจัดอันดับจากออเดอร์ซื้อสำเร็จใน 30 วันล่าสุด</p><ShopCatalogEditor products={catalog.products.map(p=>({code:p.code,name:p.name}))} initial={settings}/></>;
}
