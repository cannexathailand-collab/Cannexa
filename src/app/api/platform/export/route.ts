import {db} from '@/lib/db';
import {csvCell} from '@/lib/policy';
import {requirePlatformAdministrator,shopDatabase} from '@/lib/platform-shops';
import {platformCustomerData} from '@/lib/platform-customer-data';
import {platformBusinessWorkbook} from '@/lib/platform-business-export';
export const maxDuration=60;
export async function GET(request:Request){
 let actor;try{actor=await requirePlatformAdministrator()}catch{return new Response('Forbidden',{status:403})}
 const id=new URL(request.url).searchParams.get('shop');
 const shops=await db.platformShop.findMany({where:id?{id}:{},orderBy:{createdAt:'asc'}});
 if(id&&!shops.length)return new Response('Not found',{status:404});
 if(new URL(request.url).searchParams.get('kind')==='business'){
  const file=await platformBusinessWorkbook(shops);
  await db.platformAuditLog.create({data:{actor:actor.username,action:'BUSINESS_DATA_EXPORTED',shopId:id,details:{shops:shops.map(shop=>shop.id)}}});
  return new Response(file,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="platform-business.xlsx"','Cache-Control':'no-store'}});
 }
 const lines=[['ร้านค้า','รหัสร้าน','รหัสลูกค้า','ชื่อ','โทรศัพท์','ที่อยู่','วันที่สร้าง']];
 for(const shop of shops){
  const customers=await platformCustomerData(shopDatabase(shop.schemaName));
  for(const customer of customers)lines.push([shop.name,shop.slug,customer.code,customer.name??'',customer.phone??'',customer.address??'',customer.createdAt]);
 }
 await db.platformAuditLog.create({data:{actor:actor.username,action:'CUSTOMERS_EXPORTED',shopId:id,details:{shops:shops.map(shop=>shop.id),rows:lines.length-1}}});
 return new Response('\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="platform-customers.csv"','Cache-Control':'no-store'}});
}
