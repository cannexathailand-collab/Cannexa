import {db,transaction,userLock} from './db';
import {updateShipmentFulfillment,reconcileSalesRecognition} from './sales-recognition';
import {syncStockReservationLocked} from './stock-flow';
import {confirmReportedShipment} from './shipment-report-confirmation';
import {processStockDispatch} from './stock-dispatch';
export type StockReviewAction='wait'|'cancel'|'retry';
export function assertStockReviewChangeable(dispatch:{status:string;historySavedAt?:Date|null},operation:unknown){
 if(dispatch.status==='POSTED'||dispatch.historySavedAt||operation)throw Error('STOCK_RESULT_NEEDS_VERIFICATION');
}
export async function actOnStockReview(orderId:string,action:StockReviewAction,actor:string,reason:string){
 const result=await db.$transaction(async tx=>{
  await userLock(tx,'stock-sheet-add');
  const dispatch=await db.stockDispatch.findUnique({where:{orderId}});if(!dispatch)throw Error('STOCK_REVIEW_NOT_FOUND');
  if(action==='retry'){
   if(dispatch.status==='EXCLUDED')throw Error('ORDER_CLOSED');
   if(dispatch.status==='WAITING_SHIPMENT')await transaction(async inner=>{
    await userLock(inner,'shipment-matching');
    const order=await inner.orderIntake.findUniqueOrThrow({where:{id:orderId}});if(['CANCELLED','RETURNED','WITHDRAWN','EXPIRED'].includes(order.status))throw Error('ORDER_CLOSED');
    await inner.shipment.update({where:{orderId},data:{fulfillmentStatus:'UNCONFIRMED',dispatchedAt:null}});
    await inner.stockDispatch.update({where:{orderId},data:{status:'NEEDS_REVIEW',issues:['กำลังตรวจรายงานจัดส่งอีกครั้ง']}});
   });
   return {retry:true};
  }
  const operation=await db.stockSheetOperation.findUnique({where:{id:'dispatch:'+orderId}});
  assertStockReviewChangeable(dispatch,operation);
  if(action==='cancel'){
   await updateShipmentFulfillment(orderId,'CANCELLED',actor,reason);
   const released=await syncStockReservationLocked(orderId);
   if(!['RELEASED','NOT_FOUND','DISABLED'].includes(released.status))throw Error('STOCK_RELEASE_PENDING');
   await db.stockDispatch.update({where:{orderId},data:{status:'EXCLUDED',issues:['ยกเลิกออเดอร์: '+reason]}});
   return {retry:false};
  }
  await transaction(async inner=>{
   await userLock(inner,'shipment-matching');
   const order=await inner.orderIntake.findUniqueOrThrow({where:{id:orderId}});if(['CANCELLED','RETURNED','WITHDRAWN','EXPIRED'].includes(order.status))throw Error('ORDER_CLOSED');
   await userLock(inner,order.messageKey);if(order.affiliateId)await userLock(inner,'commission-payout:'+order.affiliateId);
   const shipment=await inner.shipment.update({where:{orderId},data:{fulfillmentStatus:'WAITING_DISPATCH',dispatchedAt:null,dispatchEvidence:reason,dispatchConfirmedBy:actor}});
   await reconcileSalesRecognition(inner,order,shipment,actor);
   await inner.stockDispatch.update({where:{orderId},data:{status:'WAITING_SHIPMENT',issues:['พักไว้รอจัดส่ง: '+reason]}});
   await inner.auditLog.create({data:{actor,action:'STOCK_REVIEW_WAITING_SHIPMENT',entityId:orderId,details:{reason}}});
  });
  return {retry:false};
 },{timeout:55000,maxWait:10000});
 if(result.retry){await confirmReportedShipment(orderId,actor);return processStockDispatch(orderId,actor);}
 return {status:action==='cancel'?'EXCLUDED':'WAITING_SHIPMENT'};
}
