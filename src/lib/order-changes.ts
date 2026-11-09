import {Prisma,type OrderIntake} from '@prisma/client';
import {z} from 'zod';
import {transaction,userLock} from './db';
import {sha} from './crypto';
import {parseOrderText} from './order-parser';
import {orderStockItems,type OrderStockItem} from './order-stock-items';
import {orderRejectionReasons,orderRejectionText} from './order-validation';
import {quotedTotal} from './shipment-matching';
import {canonicalCustomerCode} from './customer-code';
import {pendingStockSaleItems,unavailableStock,type StockReader} from './order-stock-admission';
import {readStockSheet} from './stock-google';
import {releasedReservationSource} from './stock-flow-plan';
import {reservationOperationId} from './stock-flow';
import {reverseOrderSales} from './sales-cancellation';
import {salesCommissionUsesCost} from './sales-commission-rate';

export function orderEditVersion(order:Pick<OrderIntake,'rawText'|'status'>){return sha(JSON.stringify([order.rawText,order.status]));}
const inputSchema=z.object({id:z.string().min(1).max(100),requestKey:z.uuid(),expectedVersion:z.string().length(64),action:z.enum(['EDIT','CANCEL']),text:z.string().max(12000).optional(),reason:z.string().trim().max(500).optional()});
const sameItems=(a:OrderStockItem[],b:OrderStockItem[])=>JSON.stringify([...a].sort((x,y)=>x.code.localeCompare(y.code)))===JSON.stringify([...b].sort((x,y)=>x.code.localeCompare(y.code)));

export async function changeOrder(actor:string,value:unknown,read:StockReader=readStockSheet,scope?:{sellerUsername:string}){
 const parsed=inputSchema.safeParse(value);if(!parsed.success)throw Error('กรุณาตรวจข้อมูลการแก้ไขออเดอร์');
 const input=parsed.data,fingerprint=sha(JSON.stringify(input)),auditId='order-change:'+input.requestKey;
 return transaction(async tx=>{
  await userLock(tx,'shipment-matching');
  const previous=await tx.auditLog.findUnique({where:{id:auditId}});
  if(previous){if((previous.details as {fingerprint?:string}).fingerprint!==fingerprint)throw Error('คำขอเดิมมีข้อมูลเปลี่ยนแปลง กรุณาโหลดใหม่');return {id:input.id};}
  const order=await tx.orderIntake.findUniqueOrThrow({where:{id:input.id}});
  await userLock(tx,order.messageKey);await userLock(tx,'stock-sheet-add');
  const current=await tx.orderIntake.findUniqueOrThrow({where:{id:input.id}});
  if(scope&&current.sellerUsername!==scope.sellerUsername)throw Error('ยกเลิกได้เฉพาะออเดอร์ที่คุณเป็นผู้ขาย');
  if(orderEditVersion(current)!==input.expectedVersion)throw Error('ออเดอร์ถูกเปลี่ยนแปลงแล้ว กรุณาโหลดหน้าใหม่');
  if(['CANCELLED','WITHDRAWN','RETURNED','EXPIRED'].includes(current.status))throw Error('ออเดอร์นี้ปิดแล้ว');
  const [shipment,dispatch,initialSale,reservation,config]=await Promise.all([
   tx.shipment.findUnique({where:{orderId:input.id}}),tx.stockDispatch.findUnique({where:{orderId:input.id}}),
   tx.salesOrder.findUnique({where:{orderId:input.id}}),tx.stockReservation.findUnique({where:{orderId:input.id}}),tx.stockWorkflow.findUnique({where:{id:'active'}}),
  ]);
  if(initialSale)await userLock(tx,'commission-payout:'+initialSale.affiliateId);
  const sale=initialSale?await tx.salesOrder.findUnique({where:{orderId:input.id}}):null;
  if(shipment?.status==='RETURNED'||shipment?.fulfillmentStatus==='RETURNED')throw Error('รายการอยู่ในขั้นตอนตีกลับ กรุณาตรวจสอบการรับคืน');
  if(shipment?.fulfillmentStatus==='DISPATCHED'||shipment?.dispatchedAt||dispatch?.historySavedAt||dispatch?.status==='POSTED'||reservation?.status==='CONSUMED')throw Error('จัดส่งแล้ว ไม่สามารถแก้ไขหรือยกเลิกผ่านขั้นตอนก่อนส่งได้');
  if(sale?.status==='PAID'||sale?.recognizedAt)throw Error('มีการรับรู้ยอดขายหรือจ่ายค่าคอมแล้ว กรุณาตรวจบัญชีก่อนแก้ไข');
  if(input.action==='CANCEL'){
   if(reservation?.needsReconciliation||reservation?.status==='ALREADY_COUNTED'||reservation?.status==='RECONCILING')throw Error('ยอดสต๊อกเดิมยังต้องตรวจสอบ กรุณายืนยันยอดก่อนยกเลิกออเดอร์');
   await reverseOrderSales(tx,[input.id],actor);
   await tx.orderIntake.update({where:{id:input.id},data:{status:'CANCELLED'}});
   if(shipment)await tx.shipment.update({where:{tracking:shipment.tracking},data:{status:'CANCELLED',fulfillmentStatus:'CANCELLED'}});
   await tx.auditLog.create({data:{id:auditId,actor,action:'ORDER_CANCELLED',entityId:input.id,details:{fingerprint,orderNumber:current.orderNumber,reason:input.reason??'',previousStatus:current.status}}});
   return {id:input.id};
  }
  if(shipment)throw Error('มีเลขพัสดุผูกแล้ว กรุณาตรวจสอบหรือยกเลิกรายการจัดส่งก่อนแก้ไขสินค้า');
  const text=input.text??'',next=parseOrderText(text),stock=orderStockItems(text),total=quotedTotal(text);
  if(!next||stock.issues.length||total===null||total<0)throw Error('กรุณาตรวจรายการสินค้าและยอดรวมให้ครบถ้วน');
  if(next.sellerCode.toLowerCase()!==(current.sellerCode??'').toLowerCase()||canonicalCustomerCode(next.customerCode??'')!==canonicalCustomerCode(current.customerCode??'')||next.payment!==current.payment)throw Error('หน้านี้แก้ชื่อผู้รับ ที่อยู่ เบอร์ สินค้า และยอดเงินได้ โดยคงผู้ขาย รหัสลูกค้า และวิธีชำระเดิม');
  const errors=orderRejectionReasons(next);if(errors.length)throw Error(orderRejectionText(errors));
  if(next.payment!=='เคลม'&&total<=0)throw Error('ยอดรวมต้องมากกว่าศูนย์');
  const changed=!sameItems(orderStockItems(current.rawText).items,stock.items);
  if(changed&&(reservation||config?.enabled)){
   if(!config?.enabled)throw Error('กรุณาเปิดระบบสต๊อกก่อนแก้ไขรายการสินค้า');
   if(reservation&&(reservation.needsReconciliation||!['QUEUED','RESERVED'].includes(reservation.status)))throw Error('กรุณาตรวจยอดจองสต๊อกของออเดอร์นี้ก่อนแก้ไข');
   if(reservation?.adjustmentFrom||reservation?.status==='QUEUED'&&(reservation.precounted||await tx.stockSheetOperation.findUnique({where:{id:reservationOperationId(reservation)}})))throw Error('กำลังบันทึกยอดจองสต๊อก กรุณาลองแก้ไขอีกครั้งเมื่อเสร็จ');
   if(!reservation&&current.createdAt<config.activeFrom)throw Error('ออเดอร์ก่อนเริ่มระบบสต๊อก ต้องตรวจยอดรอจ่ายก่อนแก้ไขสินค้า');
   const source=await read();if(source.tab.title!==config.sourceSheet)throw Error('รอบสต๊อกเปลี่ยนแล้ว กรุณาโหลดใหม่');
   const available=reservation?.status==='RESERVED'?releasedReservationSource(reservation.items as unknown as OrderStockItem[],source,reservation.precounted).source:source;
   const reasons=unavailableStock(stock.items,available.products,await pendingStockSaleItems(tx,input.id));
   if(reasons.length)throw Error(orderRejectionText(reasons));
   if(reservation)await tx.stockReservation.update({where:{orderId:input.id},data:{items:stock.items,status:'QUEUED',generation:{increment:1},precounted:false,adjustmentFrom:reservation.status==='RESERVED'?{items:reservation.items,precounted:reservation.precounted}:Prisma.DbNull,issues:[]}});
   else await tx.stockReservation.create({data:{orderId:input.id,messageKey:current.messageKey,orderNumber:current.orderNumber,actor,items:stock.items,issues:[]}});
  }
  if(sale){
   const profit=salesCommissionUsesCost(sale.commissionBasis);
   await userLock(tx,'commission-payout:'+sale.affiliateId);
   await tx.salesOrder.update({where:{id:sale.id},data:{revenueSatang:total,commissionSatang:profit?null:Math.round(total*sale.commissionBps/10000)}});
  }
  await tx.orderIntake.update({where:{id:input.id},data:{rawText:text,recipient:next.recipient,phone:next.phone,address:next.address,issues:next.issues}});
  await tx.auditLog.create({data:{id:auditId,actor,action:'ORDER_EDITED',entityId:input.id,details:{fingerprint,orderNumber:current.orderNumber,reason:input.reason??'',before:{text:current.rawText,amountSatang:quotedTotal(current.rawText??'')},after:{text,amountSatang:total}}}});
  return {id:input.id};
 },55000);
}
