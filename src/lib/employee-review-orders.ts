import {db} from './db';
import {orderState} from './order-management';
import {needsTrackingReview,needsCodReceiptReview} from './order-tracking-review';
export const employeeTaskTypes={TRACKING:'รอเลขพัสดุเกินกำหนด',COD:'รอเงิน COD เกินกำหนด',COST:'รอต้นทุน / ค่าขนส่ง',DATA:'ตรวจสอบข้อมูลออเดอร์'} as const;
export async function employeeReviewOrders(affiliateId:string,username:string,now=new Date()){
 const orders=await db.orderIntake.findMany({where:{affiliateId,sellerUsername:username,status:{notIn:['RETURNED','CANCELLED','WITHDRAWN','EXPIRED']}},orderBy:{createdAt:'asc'}});
 const ids=orders.map(r=>r.id);
 const [shipments,sales]=await Promise.all([db.shipment.findMany({where:{orderId:{in:ids}}}),db.salesOrder.findMany({where:{orderId:{in:ids}}})]);
 const receipts=await db.codReceipt.findMany({where:{tracking:{in:shipments.map(r=>r.tracking)}}});
 const shipping=new Map(shipments.map(r=>[r.orderId,r])),money=new Map(sales.map(r=>[r.orderId,r])),received=new Map(receipts.map(r=>[r.tracking,r]));
 return orders.flatMap(order=>{
  const shipment=shipping.get(order.id),sale=money.get(order.id),receipt=shipment?received.get(shipment.tracking):undefined;
  if(orderState(order,shipment,sale,now,receipt)!=='REVIEW')return [];
  const reasons=Array.isArray(order.issues)?order.issues.map(String):[];
  if(needsTrackingReview(order,shipment?.tracking,now))reasons.push('ไม่มีเลขพัสดุเกิน 3 วัน');
  if(needsCodReceiptReview(order,shipment,receipt,now))reasons.push('จัดส่ง COD ครบ 10 วัน ยังจับคู่เงินไม่ได้');
  if(order.status==='COD_AMOUNT_MISMATCH')reasons.push('ยอดรับเงิน COD ไม่ตรง');
  if(sale?.status==='WAITING_COST')reasons.push('รอต้นทุน / ค่าขนส่ง');
  const type:keyof typeof employeeTaskTypes=needsTrackingReview(order,shipment?.tracking,now)?'TRACKING':needsCodReceiptReview(order,shipment,receipt,now)?'COD':sale?.status==='WAITING_COST'?'COST':'DATA';
  const since=type==='COD'&&shipment?.dispatchedAt?shipment.dispatchedAt:order.createdAt;
  return [{id:order.id,number:order.orderNumber,recipient:order.recipient,createdAt:order.createdAt,type,ageDays:Math.max(0,Math.floor((+now-+since)/86400000)),reasons:[...new Set(reasons.length?reasons:['ข้อมูลออเดอร์ต้องตรวจสอบ'])]}];
 });
}
