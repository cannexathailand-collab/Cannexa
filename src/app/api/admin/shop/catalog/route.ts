import {sameOrigin,admin} from '@/lib/auth';
import {managers} from '@/lib/accounts';
import {saveShopCatalogSettings} from '@/lib/shop-catalog-settings';
export async function POST(req:Request){
 let actor:string;try{actor=await admin(managers);await sameOrigin();}catch{return Response.json({error:'ไม่มีสิทธิ์แก้ไขหน้าร้าน'},{status:403});}
 try{const text=await req.text();if(text.length>400000)throw Error('INVALID_CATALOG_SETTINGS');return Response.json({ok:true,...await saveShopCatalogSettings(actor,JSON.parse(text))});}
 catch(error){const changed=error instanceof Error&&error.message==='CATALOG_SETTINGS_CHANGED';return Response.json({error:changed?'ข้อมูลถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดใหม่':'ตรวจชื่อหมวดหมู่และรายการสินค้าแล้วลองใหม่'},{status:changed?409:400});}
}
