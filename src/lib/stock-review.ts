import {db} from './db';
import {quotedTotal} from './shipment-matching';
import {orderStockItems} from './order-stock-items';
export const stockReviewStatuses=['NEEDS_REVIEW','HISTORY_SAVED','WAITING_COST','PENDING','WAITING_SHIPMENT'];
export const stockReviewStatusLabel=(status:string)=>({NEEDS_REVIEW:'รอตรวจสอบ · ตัดสต๊อกไม่สำเร็จ',HISTORY_SAVED:'บันทึกย้อนหลังแล้ว · รอตรวจผลตัดสต๊อก',WAITING_COST:'รอตรวจสอบ · รอต้นทุน',PENDING:'รอประมวลผล',WAITING_SHIPMENT:'รอจัดส่ง'}[status]??'รอตรวจสอบ');
export function stockReviewEntry(dispatch:any,order:any,sale:any,reservation:any,sellerNames:string[]=[]){
 const stored=Array.isArray(dispatch.items)&&dispatch.items.length?dispatch.items:Array.isArray(reservation?.items)&&reservation.items.length?reservation.items:orderStockItems(order?.rawText??'').items;
 return {canChange:!dispatch.historySavedAt&&dispatch.status!=='POSTED',id:dispatch.id,orderId:dispatch.orderId,orderNumber:order?.orderNumber??dispatch.orderNumber,recipient:order?.recipient??'ยังไม่ระบุชื่อ',seller:sellerNames.length===1?sellerNames[0]:order?.sellerUsername??order?.sellerCode??'ยังไม่ระบุผู้ขาย',payment:order?.payment??'ยังไม่ระบุ',salesSatang:order?.payment==='เคลม'?null:sale?.revenueSatang??quotedTotal(order?.rawText??''),items:stored.map((i:any)=>({code:String(i.code??''),name:typeof i.name==='string'?i.name:null,grams:typeof i.quantityMilliG==='number'?i.quantityMilliG/1000:null})),status:dispatch.status,statusLabel:stockReviewStatusLabel(dispatch.status),issues:Array.isArray(dispatch.issues)?dispatch.issues.map(String):[],tracking:dispatch.tracking??dispatch.candidateTracking,updatedAt:dispatch.updatedAt};
}
export async function stockReviewPage(page=1){
 const where={status:{in:stockReviewStatuses}},size=50;
 const [count,dispatches]=await Promise.all([db.stockDispatch.count({where}),db.stockDispatch.findMany({where,orderBy:{updatedAt:'desc'},skip:(page-1)*size,take:size})]);
 const ids=dispatches.map(d=>d.orderId);
 const [orders,sales,reservations]=await Promise.all([db.orderIntake.findMany({where:{id:{in:ids}}}),db.salesOrder.findMany({where:{orderId:{in:ids}}}),db.stockReservation.findMany({where:{orderId:{in:ids}}})]);
 const sellers=await db.userAccount.findMany({where:{affiliateId:{in:orders.flatMap(o=>o.affiliateId?[o.affiliateId]:[])},active:true},select:{affiliateId:true,username:true}});
 return {count,page,pages:Math.max(1,Math.ceil(count/size)),rows:dispatches.map(d=>{const order=orders.find(o=>o.id===d.orderId);return stockReviewEntry(d,order,sales.find(s=>s.orderId===d.orderId),reservations.find(r=>r.orderId===d.orderId),sellers.filter(s=>s.affiliateId===order?.affiliateId).map(s=>s.username));})};
}
