import {NextResponse} from 'next/server';
import {currentAccount,sameOrigin} from '@/lib/auth';
import {portalCustomer,hasPortalAccess} from '@/lib/customer-portal';
import {createWebsiteOrder} from '@/lib/website-orders';

const messages:Record<string,string>={
 INVALID_WEBSITE_ORDER:'กรุณาตรวจรายการสินค้าและจำนวนอีกครั้ง',
 INVALID_DELIVERY:'กรุณากรอกชื่อ เบอร์โทร และที่อยู่จัดส่งในข้อมูลส่วนตัวให้ครบก่อนส่งออเดอร์',
 ORDER_TOO_LARGE:'ยอดรวมออเดอร์เกินขอบเขตที่ระบบรองรับ กรุณาลดจำนวนสินค้า',
 PRICE_CHANGED:'ราคาสินค้ามีการเปลี่ยนแปลง กรุณาตรวจราคาอีกครั้ง',
 STOCK_CHANGED:'จำนวนสินค้าที่พร้อมขายมีการเปลี่ยนแปลง กรุณาตรวจจำนวนอีกครั้ง',
 PRODUCT_UNAVAILABLE:'สินค้าหรือขนาดที่เลือกยังไม่พร้อมขาย กรุณาตรวจรายการอีกครั้ง',
 TOTAL_CHANGED:'ยอดรวมมีการเปลี่ยนแปลง กรุณาตรวจออเดอร์อีกครั้ง',
 REQUEST_CONFLICT:'คำขอเดิมมีรายการแตกต่างกัน กรุณาตรวจประวัติออเดอร์ก่อนส่งใหม่',
 CUSTOMER_PENDING:'กำลังรอร้านอนุมัติสมาชิก',
 CUSTOMER_NOT_FOUND:'กรุณาเข้าสู่ระบบลูกค้า',
 PAYMENT_REQUIRED:'กรุณาเลือกวิธีชำระเงิน',
 INVALID_PAYMENT:'ข้อมูลวิธีชำระเงินไม่ถูกต้อง กรุณาเลือกใหม่',
 SHIPPING_CHANGED:'ค่าจัดส่งมีการเปลี่ยนแปลง กรุณาตรวจยอดรวมอีกครั้ง',
 BANK_UNAVAILABLE:'ร้านยังไม่ได้ตั้งค่าบัญชีรับโอน กรุณาเลือกวิธีชำระเงินอื่น',
 BANK_CHANGED:'บัญชีรับโอนมีการเปลี่ยนแปลง กรุณาตรวจรายละเอียดใหม่ก่อนส่งออเดอร์',
 SLIP_REQUIRED:'กรุณาแนบสลิปโอนเงิน',
 INVALID_SLIP:'กรุณาแนบสลิปเป็นรูป JPG, PNG หรือ WebP ที่เปิดอ่านได้',
 SLIP_TOO_LARGE:'รูปสลิปต้องมีขนาดไม่เกิน 2 MB',
};
const conflicts=new Set(['PRICE_CHANGED','STOCK_CHANGED','PRODUCT_UNAVAILABLE','TOTAL_CHANGED','REQUEST_CONFLICT','SHIPPING_CHANGED','BANK_CHANGED']);
const invalid=new Set(['INVALID_WEBSITE_ORDER','INVALID_DELIVERY','ORDER_TOO_LARGE','PAYMENT_REQUIRED','INVALID_PAYMENT','BANK_UNAVAILABLE','SLIP_REQUIRED','INVALID_SLIP','SLIP_TOO_LARGE']);

export async function POST(request:Request){
 try{await sameOrigin();}catch{return NextResponse.json({error:'ไม่อนุญาต',code:'FORBIDDEN'},{status:403});}
 try{
  try{
   if((await currentAccount()).role==='owner')return NextResponse.json({error:'โหมดเจ้าของระบบใช้สำหรับดูข้อมูล กรุณาเข้าสู่ระบบลูกค้าเพื่อส่งออเดอร์',code:'OWNER_PREVIEW'},{status:403});
  }catch(error){if(!(error instanceof Error)||error.message!=='UNAUTHORIZED')throw error;}
  const {key,customer}=await portalCustomer();
  if(customer?.portalRegistrationPending||customer?.portalProfileIncomplete)return NextResponse.json({error:messages.CUSTOMER_PENDING,code:'CUSTOMER_PENDING'},{status:403});
  if(!customer||!await hasPortalAccess(key,customer.code))return NextResponse.json({error:messages.CUSTOMER_NOT_FOUND,code:'UNAUTHORIZED'},{status:401});
  const text=await request.text();
  if(Buffer.byteLength(text,'utf8')>3*1024*1024)return NextResponse.json({error:messages.SLIP_TOO_LARGE,code:'SLIP_TOO_LARGE'},{status:400});
  let input:unknown;
  try{input=JSON.parse(text);}catch{return NextResponse.json({error:messages.INVALID_WEBSITE_ORDER,code:'INVALID_WEBSITE_ORDER'},{status:400});}
  const saved=await createWebsiteOrder(customer.code,input);
  return NextResponse.json({ok:true,order:{id:saved.id,orderNumber:saved.orderNumber,status:saved.status,totalSatang:saved.totalSatang}},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){
  const code=error instanceof Error?error.message:'';
  const status=conflicts.has(code)?409:invalid.has(code)?400:code==='CUSTOMER_PENDING'?403:code==='CUSTOMER_NOT_FOUND'?401:503;
  return NextResponse.json({error:messages[code]??'ส่งออเดอร์ไม่สำเร็จ กรุณาลองส่งคำขอเดิมอีกครั้ง',code:messages[code]?code:'UNAVAILABLE'},{status});
 }
}
