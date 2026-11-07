import {customerCatalogAccess,loadCustomerCatalog} from '@/lib/customer-catalog';

export async function GET(){
 try{
  const access=await customerCatalogAccess();
  if(access==='pending')return Response.json({error:'กำลังรอร้านอนุมัติสมาชิก'},{status:403});
  if(!access)return Response.json({error:'กรุณาเข้าสู่ระบบลูกค้า'},{status:401});
  return Response.json(await loadCustomerCatalog(),{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'โหลดรายการสินค้าไม่สำเร็จ กรุณาลองใหม่'},{status:503});}
}
