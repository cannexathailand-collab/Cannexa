import type {Prisma,OrderIntake,Shipment} from "@prisma/client";
import {db,transaction,userLock} from "./db";
import {quotedTotal} from "./shipment-matching";
export function hasActualDispatch(shipment:Pick<Shipment,"fulfillmentStatus"|"dispatchedAt"|"status">){return shipment.fulfillmentStatus==="DISPATCHED"&&!!shipment.dispatchedAt&&!["RETURNED","CANCELLED","WITHDRAWN"].includes(shipment.status);}
export async function revokeSalesRecognition(tx:Prisma.TransactionClient,sale:{id:string;orderId:string;tracking:string|null;recognizedAt:Date|null;revenueSatang:number},actor:string,reason:string){
 if(!sale.recognizedAt)return;
 await tx.salesOrder.update({where:{id:sale.id},data:{recognizedAt:null}});
 await tx.auditLog.create({data:{actor,action:"SALES_RECOGNITION_REVERSED",entityId:sale.id,details:{orderId:sale.orderId,tracking:sale.tracking,amountSatang:sale.revenueSatang,dispatchedAt:sale.recognizedAt.toISOString(),reason}}});
}
export async function reconcileSalesRecognition(tx:Prisma.TransactionClient,order:OrderIntake,shipment:Shipment,actor:string){
 const commissionAffiliateId=order.commissionAffiliateId??order.affiliateId;
 if(commissionAffiliateId)await userLock(tx,'commission-payout:'+commissionAffiliateId);
 const previous=await tx.salesOrder.findUnique({where:{orderId:order.id}});
 if(!hasActualDispatch(shipment)||!["โอน","COD"].includes(order.payment??"")||["RETURNED","CANCELLED","WITHDRAWN"].includes(order.status)){
  if(previous)await revokeSalesRecognition(tx,previous,actor,"ไม่เข้าเงื่อนไขจัดส่งจริง");return;
 }
 if(!order.affiliateId||order.salesCommissionBps===null||!order.salesCommissionBasis)throw Error("SELLER_NOT_READY");
 const cod=order.payment==="COD",amount=cod?shipment.codSatang:quotedTotal(order.rawText??"");if(!amount||amount<0)throw Error("INVALID_SALES_AMOUNT");
 if(shipment.orderId!==order.id)throw Error("SALE_CONFLICT");
 if(previous&&(previous.paymentMethod!==(cod?"COD":"TRANSFER")||previous.status==="CANCELLED"||(previous.tracking&&previous.tracking!==shipment.tracking)||previous.revenueSatang!==amount))throw Error("SALE_CONFLICT");
 const receipt=cod?await tx.codReceipt.findUnique({where:{tracking:shipment.tracking}}):null;
 const received=!cod||receipt?.amountSatang===amount,profit=(previous?.commissionBasis??order.salesCommissionBasis)==="PROFIT",bps=previous?.commissionBps??order.salesCommissionBps;
 const status=previous?.status==="PAID"?"PAID":!received?"WAITING_COD":profit?"WAITING_COST":"PENDING";
 const commission=previous?.status==="PAID"?previous.commissionSatang:!received||profit?null:Math.round(amount*bps/10000);
 const recognizedAt=received?shipment.dispatchedAt!:null;
 const values={tracking:shipment.tracking,recognizedAt,status,commissionSatang:commission,paymentEvidence:cod?(received?"COD_RECEIPT":"AWAITING_COD_RECEIPT"):"DECLARED_TRANSFER"};
 const sale=previous?await tx.salesOrder.update({where:{id:previous.id},data:values}):await tx.salesOrder.create({data:{...values,orderId:order.id,affiliateId:commissionAffiliateId!,paymentMethod:cod?"COD":"TRANSFER",revenueSatang:amount,commissionBasis:order.salesCommissionBasis,commissionBps:bps}});
 if((previous?.recognizedAt?.getTime()??null)!==(recognizedAt?.getTime()??null))await tx.auditLog.create({data:{actor,action:"SALES_RECOGNITION_CHANGED",entityId:sale.id,details:{orderId:order.id,tracking:shipment.tracking,amountSatang:amount,previousDispatchedAt:previous?.recognizedAt?.toISOString()??null,dispatchedAt:recognizedAt?.toISOString()??null,evidence:shipment.dispatchEvidence}}});
}
export async function updateShipmentFulfillment(orderId:string,action:"DISPATCHED"|"RETURNED"|"CANCELLED",actor:string,evidence:string,dispatchedAt?:Date){
 if(!evidence.trim()||evidence.length>500||action==="DISPATCHED"&&(!dispatchedAt||!Number.isFinite(+dispatchedAt)||+dispatchedAt>Date.now()+300000||dispatchedAt.getUTCFullYear()<2000))throw Error("DISPATCH_EVIDENCE_REQUIRED");
 await transaction(async tx=>{
  await userLock(tx,"shipment-matching");const order=await tx.orderIntake.findUniqueOrThrow({where:{id:orderId}});await userLock(tx,order.messageKey);
  const shipment=await tx.shipment.findUniqueOrThrow({where:{orderId}});if(order.affiliateId)await userLock(tx,"commission-payout:"+order.affiliateId);
  if(action==="DISPATCHED"&&["RETURNED","CANCELLED","WITHDRAWN"].includes(order.status))throw Error("ORDER_CLOSED");
  const changed=shipment.fulfillmentStatus!==action||(action==="DISPATCHED"&&shipment.dispatchedAt?.getTime()!==dispatchedAt!.getTime())||shipment.dispatchEvidence!==evidence.trim();
  const updated=await tx.shipment.update({where:{tracking:shipment.tracking},data:{fulfillmentStatus:action,...(action==="DISPATCHED"?{dispatchedAt,dispatchEvidence:evidence.trim(),dispatchConfirmedBy:actor}:{status:action})}});
  let current=order;
  if(action!=="DISPATCHED")current=await tx.orderIntake.update({where:{id:order.id},data:{status:action}});
  await reconcileSalesRecognition(tx,current,updated,actor);
  if(action!=="DISPATCHED")await tx.salesOrder.updateMany({where:{orderId:order.id,status:{not:"PAID"}},data:{status:"CANCELLED",commissionSatang:0,recognizedAt:null}});
  if(changed)await tx.auditLog.create({data:{actor,action:"SHIPMENT_FULFILLMENT_CHANGED",entityId:order.id,details:{tracking:shipment.tracking,previousStatus:shipment.fulfillmentStatus,status:action,dispatchedAt:updated.dispatchedAt?.toISOString()??null,evidence:evidence.trim()}}});
 });
}
export async function recalculateSalesRecognition(actor:string){
 const sales=await db.salesOrder.findMany();let recalculated=0;
 for(const sale of sales)await transaction(async tx=>{await userLock(tx,"shipment-matching");await userLock(tx,"commission-payout:"+sale.affiliateId);const [order,shipment]=await Promise.all([tx.orderIntake.findUnique({where:{id:sale.orderId}}),tx.shipment.findUnique({where:{orderId:sale.orderId}})]);if(order&&shipment)await reconcileSalesRecognition(tx,order,shipment,actor);else await revokeSalesRecognition(tx,sale,actor,"ย้อนหลัง: ไม่มีหลักฐานจัดส่งจริงที่ผูกกับออเดอร์");recalculated++;});
 const verified=await db.shipment.findMany({where:{fulfillmentStatus:"DISPATCHED",dispatchedAt:{not:null},orderId:{not:null}}});
 for(const candidate of verified)await transaction(async tx=>{await userLock(tx,"shipment-matching");const shipment=await tx.shipment.findUnique({where:{tracking:candidate.tracking}});if(!shipment?.orderId)return;const order=await tx.orderIntake.findUnique({where:{id:shipment.orderId}});if(order){if(order.affiliateId)await userLock(tx,"commission-payout:"+order.affiliateId);await reconcileSalesRecognition(tx,order,shipment,actor);}});
 return {recalculated,verifiedShipments:verified.length};
}
