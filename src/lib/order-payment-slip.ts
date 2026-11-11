import type {Prisma} from '@prisma/client';
import {db,transaction,userLock} from './db';
import {parseRewardImage} from './crm-reward-image';
import {isEmployeeRole,managers} from './accounts';
import {quotedTotal} from './shipment-matching';
import {salesCommissionRate,salesCommissionUsesCost} from './sales-commission-rate';
import {reconcileSalesRecognition} from './sales-recognition';

export const missingPaymentSlip='กรุณาแนบสลิปการโอนเงินในออเดอร์ก่อนยืนยันยอดโอน';
export type PaymentSlip=ReturnType<typeof parseRewardImage>;
export function canAttachPaymentSlip(actor:{role:string;username:string},order:{sellerUsername:string|null}){
 return managers.includes(actor.role as never)||(isEmployeeRole(actor.role)&&order.sellerUsername===actor.username);
}
export async function readOrderPaymentSlip(orderId:string,client:Pick<Prisma.TransactionClient,'orderPaymentSlip'|'websiteOrder'>=db){
 const slip=await client.orderPaymentSlip.findUnique({where:{orderId},select:{version:true}});
 if(slip)return {version:slip.version,url:'/api/admin/orders/'+encodeURIComponent(orderId)+'/slip?v='+slip.version};
 const website=await client.websiteOrder.findFirst({where:{intakeOrderId:orderId,slipVersion:{not:null}},select:{id:true,slipVersion:true}});
 return website?.slipVersion?{version:website.slipVersion,url:'/api/customer/website-orders/'+encodeURIComponent(website.id)+'/slip?v='+website.slipVersion}:null;
}
export async function attachOrderPaymentSlip(actor:{role:string;username:string},id:string,value:string){
 const image=parseRewardImage(value);
 return transaction(async tx=>{
  await userLock(tx,'shipment-matching');
  const order=await tx.orderIntake.findUniqueOrThrow({where:{id}});
  await userLock(tx,order.messageKey);
  if(!canAttachPaymentSlip(actor,order))throw Error('FORBIDDEN');
  if(order.payment!=='โอน'||['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(order.status))throw Error('ORDER_CLOSED');
  const existing=await tx.orderPaymentSlip.findUnique({where:{orderId:id}});
  if(existing){if(existing.version===image.imageVersion)return;throw Error('SLIP_EXISTS');}
  await tx.orderPaymentSlip.create({data:{orderId:id,data:image.imageData,mime:image.imageMime,version:image.imageVersion}});
  const issues=Array.isArray(order.issues)?order.issues.map(String):[];
  if(issues.includes(missingPaymentSlip)){
   const remaining=issues.filter(issue=>issue!==missingPaymentSlip);
   const ready=!remaining.length&&!!order.commissionAffiliateId&&order.salesCommissionBps!==null&&!!order.salesCommissionBasis;
   const updated=await tx.orderIntake.update({where:{id},data:{issues:remaining,...(ready?{status:'TRANSFER_RECORDED'}:{})}});
   if(ready){
    const total=quotedTotal(order.rawText??'');if(!total||total<=0)throw Error('INVALID_AMOUNT');
    await userLock(tx,'commission-payout:'+order.commissionAffiliateId);
    if(!await tx.salesOrder.findUnique({where:{orderId:id}})){
     const profit=salesCommissionUsesCost(order.salesCommissionBasis!);
     await tx.salesOrder.create({data:{orderId:id,affiliateId:order.commissionAffiliateId!,paymentMethod:'TRANSFER',paymentEvidence:'DECLARED_TRANSFER',revenueSatang:total,commissionBasis:order.salesCommissionBasis!,commissionBps:order.salesCommissionBps!,commissionSatang:profit?null:Math.round(total*order.salesCommissionBps!/10000),commissionReadyAt:profit?null:new Date(),status:profit?'WAITING_COST':'PENDING'}});
    }
    if(order.affiliateId&&order.affiliateId!==order.commissionAffiliateId){
     const seller=await tx.affiliate.findUniqueOrThrow({where:{id:order.affiliateId}});
     await tx.additionalCommission.upsert({where:{orderId_affiliateId:{orderId:id,affiliateId:seller.id}},create:{orderId:id,affiliateId:seller.id,basis:seller.salesCommissionBasis,bps:salesCommissionRate(seller,'โอน')},update:{}});
    }
    const shipment=await tx.shipment.findUnique({where:{orderId:id}});
    if(shipment)await reconcileSalesRecognition(tx,updated,shipment,actor.username);
   }
  }
  await tx.auditLog.create({data:{actor:actor.username,action:'ORDER_PAYMENT_SLIP_ATTACHED',entityId:id,details:{version:image.imageVersion}}});
 });
}
