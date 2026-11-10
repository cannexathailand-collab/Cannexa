import {redirect} from 'next/navigation';
import {db} from '@/lib/db';
import {requirePlatformAdministrator,platformShopData,shopDatabase} from '@/lib/platform-shops';
import {platformCustomerData} from '@/lib/platform-customer-data';
import {PlatformCustomerDashboard} from '../customer-dashboard';

export default async function PlatformCustomers({searchParams}:{searchParams:Promise<{shop?:string}>}){
 let actor;try{actor=await requirePlatformAdministrator()}catch{redirect('/admin')}
 const {shop:id}=await searchParams;
 const shops=await db.platformShop.findMany({orderBy:{createdAt:'asc'}});
 const selectedId=id??shops[0]?.id;
 const selected=selectedId?await platformShopData(actor.username,selectedId).catch(()=>null):null;
 let rows=null,error='';
 if(selected){
  try{rows=await platformCustomerData(shopDatabase(selected.shop.schemaName));}
  catch{error='โหลดข้อมูลลูกค้าร้านนี้ไม่สำเร็จ กรุณาลองใหม่';}
 }
 return <main className="main"><h1>แดชบอร์ดลูกค้าทุกร้าน</h1>
  <section className="card"><h2>เลือกร้านเพื่อดูข้อมูลลูกค้า</h2><form className="actions" action="/platform/customers"><label>เลือกร้าน<select name="shop" defaultValue={selectedId}>{shops.map(shop=><option key={shop.id} value={shop.id}>{shop.name} ({shop.slug})</option>)}</select></label><button>ดูแดชบอร์ดร้าน</button></form>{selected&&<p>กำลังดูข้อมูลของ {selected.shop.name}</p>}{id&&!selected&&<p role="alert">ไม่พบข้อมูลร้านที่เลือก</p>}</section>
  {error&&<p role="alert" className="notice">{error}</p>}
  {rows&&selected&&<><PlatformCustomerDashboard key={selected.shop.id} rows={rows} shopId={selected.shop.id}/><div className="actions"><a className="button secondary" href={'/api/platform/export?shop='+encodeURIComponent(selected.shop.id)}>รายชื่อลูกค้าร้านนี้ (CSV)</a><a className="button secondary" href={'/api/platform/export?kind=business&shop='+encodeURIComponent(selected.shop.id)}>ข้อมูลธุรกิจร้านนี้ (Excel)</a></div></>}
 </main>;
}
