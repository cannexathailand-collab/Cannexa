import {sameOrigin} from '@/lib/auth';
import {withShopMutation} from '@/lib/shop-workspace';
import {issueCustomerReceipt} from '@/lib/customer-receipts';
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
 await sameOrigin();const {slug}=await params;
 return withShopMutation(slug,async({account})=>{
  try{
   const text=await request.text();if(text.length>1000)throw Error('INVALID');
   const {orderId}=JSON.parse(text);if(typeof orderId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(orderId))throw Error('INVALID');
   const receipt=await issueCustomerReceipt(orderId,account.username);
   return Response.json({id:receipt.id},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'ยังออกใบเสร็จไม่ได้ กรุณาตรวจข้อมูลผู้ออกใบเสร็จและการรับเงินของออเดอร์'},{status:409});}
 });
}
