import type {GmailImport,OrderIntake,Shipment} from '@prisma/client';
import {db,transaction,userLock} from './db';
import {reconcileSalesRecognition} from './sales-recognition';

export const reportConfirmationActor='shipment-report';
export const matchedReportStatuses=['MATCHED','MATCHED_TRANSFER','MATCHED_CLAIM','MATCHED_WAITING_COD'];
export function shipmentReportEvidence(order:OrderIntake|null,shipment:Shipment|null,report:GmailImport|null,activeFrom:Date,enrolled=false,now=new Date()){
 if(!order||!shipment||!report||shipment.orderId!==order.id||shipment.importId!==report.id)return null;
 if(shipment.fulfillmentStatus!=='UNCONFIRMED'||shipment.dispatchedAt||!matchedReportStatuses.includes(shipment.status))return null;
 if(['CANCELLED','RETURNED','WITHDRAWN','EXPIRED','NEEDS_REVIEW'].includes(order.status)||!['โอน','COD','เคลม'].includes(order.payment??''))return null;
 if(!enrolled&&(order.createdAt<activeFrom||order.eventAt<activeFrom))return null;
 if(report.kind!=='SHIPMENT'||!report.messageId||!report.filename.toLowerCase().endsWith('.xlsx')||report.rowCount<1)return null;
 if(!Number.isFinite(+report.reportAt)||report.reportAt<activeFrom||report.reportAt<order.eventAt||+report.reportAt>+now+300000||+report.reportAt!==+shipment.reportAt)return null;
 return {dispatchedAt:report.reportAt,dispatchConfirmedBy:reportConfirmationActor,dispatchEvidence:'ยืนยันอัตโนมัติจากรายงานจัดส่งทางอีเมล: '+report.filename+' · ใช้วันที่รับรายงาน ไม่ใช่วันที่ผู้รับได้รับพัสดุ'};
}

export async function confirmReportedShipment(orderId:string,actor:string){
 let candidate:{orderNumber:string;candidateTracking:string;payment:string|null;dispatchedAt:Date}|undefined;
 try{return await transaction(async tx=>{
  await userLock(tx,'shipment-matching');
  const config=await tx.stockIntegrationConfig.findUnique({where:{id:'active'}});if(!config?.enabled)return false;
  const [order,shipment,reservation]=await Promise.all([tx.orderIntake.findUnique({where:{id:orderId}}),tx.shipment.findUnique({where:{orderId}}),tx.stockReservation.findUnique({where:{orderId}})]);
  if(!order||!shipment||reservation&&['CONSUMED','RELEASED','ALREADY_COUNTED','RECONCILING'].includes(reservation.status)||reservation?.needsReconciliation)return false;
  const report=await tx.gmailImport.findUnique({where:{id:shipment.importId}});
  const evidence=shipmentReportEvidence(order,shipment,report,config.activeFrom,!!reservation);if(!evidence)return false;
  candidate={orderNumber:order.orderNumber,candidateTracking:shipment.tracking,payment:order.payment,dispatchedAt:evidence.dispatchedAt};
  await userLock(tx,order.messageKey);if(order.affiliateId)await userLock(tx,'commission-payout:'+order.affiliateId);
  const updated=await tx.shipment.update({where:{tracking:shipment.tracking},data:{fulfillmentStatus:'DISPATCHED',...evidence}});
  await reconcileSalesRecognition(tx,order,updated,actor);
  await tx.auditLog.upsert({where:{id:'shipment-report-confirmed:'+shipment.tracking},create:{id:'shipment-report-confirmed:'+shipment.tracking,actor,action:'SHIPMENT_REPORT_CONFIRMED',entityId:orderId,details:{tracking:shipment.tracking,importId:report!.id,dateBasis:'EMAIL_REPORT_RECEIVED_AT',reportAt:report!.reportAt.toISOString()}},update:{}});
  return true;
 });}catch(error){
  if(candidate){
   const message=error instanceof Error?error.message:'';
   const issue=message==='SELLER_NOT_READY'?'ข้อมูลผู้ขายหรือกติกาค่าคอมมิชชันยังไม่ครบ กรุณาตรวจผู้ขายในออเดอร์':message==='INVALID_SALES_AMOUNT'?'อ่านยอดขายของออเดอร์ไม่ได้ กรุณาตรวจยอดรวม':message==='SALE_CONFLICT'?'ข้อมูลยอดขายหรือเลขพัสดุไม่ตรงกับรายการเดิม กรุณาตรวจออเดอร์':'จับคู่รายงานจัดส่งแล้ว แต่ยังประมวลผลต่อไม่สำเร็จ กรุณาตรวจและลองใหม่';
   await db.stockDispatch.upsert({where:{orderId},create:{orderId,...candidate,status:'NEEDS_REVIEW',issues:[issue]},update:{}});
   await db.stockDispatch.updateMany({where:{orderId,historySavedAt:null,status:{in:['PENDING','NEEDS_REVIEW','WAITING_COST']}},data:{status:'NEEDS_REVIEW',issues:[issue]}});
  }
  throw error;
 }
}

export async function confirmReportedShipments(actor:string){
 const failedOrderIds:string[]=[];
 const config=await db.stockIntegrationConfig.findUnique({where:{id:'active'}});if(!config?.enabled)return {confirmed:0,failedOrderIds};
 const rows=await db.shipment.findMany({where:{orderId:{not:null},fulfillmentStatus:'UNCONFIRMED',status:{in:matchedReportStatuses},reportAt:{gte:config.activeFrom}},orderBy:{reportAt:'asc'},take:100});
 let confirmed=0;for(const row of rows)if(await confirmReportedShipment(row.orderId!,actor).catch(()=>{failedOrderIds.push(row.orderId!);return false;}))confirmed++;
 return {confirmed,failedOrderIds};
}
