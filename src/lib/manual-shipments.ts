import {z} from 'zod';
import {db,transaction,userLock} from './db';
import {sha} from './crypto';
import {phonesMatch,quotedTotal,compatibleAddress} from './shipment-matching';
import {parseDispatchTime} from './sales-dates';
import {reconcileSalesRecognition} from './sales-recognition';
import type {ManualShipmentRow} from './manual-shipment-file';
import {parseOrderAddress} from './order-parser';
import {matchingRejectedOrders} from './rejected-shipments';

const eligible=['WAITING_SHIPMENT','TRANSFER_RECORDED','CLAIM_WAITING_COST','MATCHED_SHIPMENT_WAITING_COD','COD_AMOUNT_MISMATCH'];
export function manualShipmentMatches(row:Pick<ManualShipmentRow,'phone'|'amountSatang'>,order:{phone:string|null;rawText:string|null}){
 return row.amountSatang!==undefined&&!!order.phone&&phonesMatch(order.phone,row.phone)&&quotedTotal(order.rawText??'')===row.amountSatang;
}
export function assignManualShipmentOrders<T extends {existingOrderId:string|null;candidates:{id:string;addressMatches?:boolean}[]}>(rows:T[]){
 const used=new Set<string>();
 return rows.map(row=>{
  const matching=row.candidates.length>1?row.candidates.filter(order=>order.addressMatches):row.candidates;
  const selected=row.existingOrderId?null:matching.find(order=>!used.has(order.id));
  if(selected)used.add(selected.id);
  return {...row,selectedOrderId:selected?.id??null};
 });
}
export async function previewManualShipments(rows:ManualShipmentRow[]){
 if(rows.some(row=>row.amountSatang===undefined))throw Error('ไฟล์ต้องมีคอลัมน์ยอดเงิน เพื่อจับคู่ด้วยเบอร์โทรและยอดขาย');
 const [orders,shipments,rejections]=await Promise.all([
  db.orderIntake.findMany({orderBy:[{eventAt:'asc'},{id:'asc'}],select:{id:true,orderNumber:true,recipient:true,phone:true,payment:true,eventAt:true,rawText:true,address:true,status:true,affiliateId:true}}),
  db.shipment.findMany({select:{tracking:true,orderId:true}}),
  db.auditLog.findMany({where:{action:'ORDER_REJECTED'},orderBy:{createdAt:'desc'},select:{id:true,createdAt:true,details:true}}),
 ]);
 return assignManualShipmentOrders(rows.map(row=>{
  const existing=shipments.find(shipment=>shipment.tracking===row.tracking);
  const rejectedOrders=matchingRejectedOrders(row,rejections);
  const phoneOrders=orders.filter(order=>!!order.phone&&phonesMatch(order.phone,row.phone));
  const amountOrders=phoneOrders.filter(order=>manualShipmentMatches(row,order));
  const readyOrders=amountOrders.filter(order=>eligible.includes(order.status)&&order.affiliateId);
  const candidates=readyOrders.filter(order=>!shipments.some(shipment=>shipment.orderId===order.id&&shipment.tracking!==row.tracking)).map(({rawText,status,affiliateId,...order})=>({...order,eventAt:order.eventAt.toISOString(),amountSatang:quotedTotal(rawText??''),addressMatches:!!row.address&&compatibleAddress(parseOrderAddress(rawText??'')??order.address??'',row.address)}));
  let matchMessage='';
  if(existing?.orderId)matchMessage='เลขพัสดุนี้ผูกออเดอร์แล้ว';
  else if(!phoneOrders.length)matchMessage=rejectedOrders.length?'พบประวัติปฏิเสธที่เบอร์โทรและยอดขายตรงกัน':'ไม่พบเบอร์โทรนี้ในออเดอร์ของระบบ';
  else if(!amountOrders.length){
   const totals=[...new Set(phoneOrders.map(order=>quotedTotal(order.rawText??'')).filter(total=>total!==null))];
   matchMessage='พบเบอร์โทร แต่ยอดขายไม่ตรง'+(totals.length?' · ยอดในระบบ '+totals.map(total=>(total/100).toLocaleString('th-TH')+' บาท').join(', '):' · ออเดอร์ไม่มีข้อมูลยอดขายที่อ่านได้');
  }
  else if(!readyOrders.length)matchMessage='พบเบอร์และยอดตรงกัน แต่ออเดอร์ไม่อยู่ในสถานะที่นำเข้าส่งได้';
  else if(!candidates.length)matchMessage='ออเดอร์ที่เบอร์และยอดตรงกันผูกกับเลขพัสดุอื่นแล้ว';
  return {...row,candidates,existingOrderId:existing?.orderId??null,matchMessage,rejectedOrders};
 }));
}
const input=z.object({requestKey:z.uuid(),filename:z.string().min(1).max(250),dispatchedAt:z.string(),confirmed:z.literal(true),rows:z.array(z.object({tracking:z.string().regex(/^[A-Z0-9-]{8,50}$/),recipient:z.string().max(200),phone:z.string().min(1).max(100),orderId:z.string().min(1).max(100),payment:z.enum(['COD','โอน']).optional(),amountSatang:z.number().int().nonnegative().max(2147483647).optional()})).min(1).max(500)});
export async function importManualShipments(actor:string,value:unknown){
 const parsed=input.safeParse(value);if(!parsed.success)throw Error('กรุณาตรวจรายการและยืนยันว่าได้ส่งพัสดุแล้ว');
 const data=parsed.data,dispatchedAt=parseDispatchTime(data.dispatchedAt);
 if(new Set(data.rows.map(row=>row.tracking)).size!==data.rows.length||new Set(data.rows.map(row=>row.orderId)).size!==data.rows.length)throw Error('เลขพัสดุหรือออเดอร์ซ้ำ กรุณาเลือกใหม่');
 const fingerprint=sha(JSON.stringify({rows:data.rows,dispatchedAt:data.dispatchedAt,filename:data.filename}));
 return transaction(async tx=>{
  await userLock(tx,'shipment-matching');
  const previous=await tx.manualShipmentImport.findUnique({where:{id:data.requestKey}});
  if(previous){if(previous.fingerprint!==fingerprint)throw Error('คำขอเดิมมีข้อมูลเปลี่ยนแปลง กรุณาโหลดหน้าใหม่');return {count:data.rows.length,orderIds:data.rows.map(row=>row.orderId)};}
  for(const row of data.rows){
   const order=await tx.orderIntake.findUnique({where:{id:row.orderId}});
   if(!order||!order.affiliateId||!manualShipmentMatches(row,order))throw Error('เบอร์โทรหรือยอดขายของ '+row.tracking+' ไม่ตรงกับออเดอร์ กรุณาตรวจใหม่');
   if(row.payment&&row.payment!==order.payment||row.amountSatang!==undefined&&row.amountSatang!==quotedTotal(order.rawText??''))throw Error('วิธีชำระเงินหรือยอดเงินในไฟล์ไม่ตรงกับ '+order.orderNumber);
   if(order.eventAt>dispatchedAt)throw Error('วันเวลาส่งต้องอยู่หลังรับออเดอร์ '+order.orderNumber);
   await userLock(tx,order.messageKey);
   const [existing,other]=await Promise.all([tx.shipment.findUnique({where:{tracking:row.tracking}}),tx.shipment.findUnique({where:{orderId:order.id}})]);
   if(other&&other.tracking!==row.tracking||existing?.orderId&&existing.orderId!==order.id)throw Error('เลขพัสดุหรือออเดอร์นี้ถูกผูกกับรายการอื่นแล้ว');
   if(existing&&['RETURNED','CANCELLED'].includes(existing.status))throw Error('เลขพัสดุนี้ถูกยกเลิกหรือตีกลับแล้ว');
   if(existing?.orderId===order.id&&existing.fulfillmentStatus==='DISPATCHED')continue;
   if(!eligible.includes(order.status))throw Error('ออเดอร์ '+order.orderNumber+' ไม่อยู่ในสถานะรอส่ง');
   const cod=order.payment==='COD'?quotedTotal(order.rawText??''):0;
   if(cod===null||cod<0)throw Error('อ่านยอด COD ของ '+order.orderNumber+' ไม่ได้');
   if(existing&&(existing.codSatang!==cod||!phonesMatch(existing.phone,row.phone)))throw Error('ข้อมูลรายงานของ '+row.tracking+' ขัดกับออเดอร์');
   const status=order.payment==='COD'?'MATCHED_WAITING_COD':order.payment==='เคลม'?'MATCHED_CLAIM':'MATCHED_TRANSFER';
   const evidence='นำเข้าไฟล์เลขพัสดุ '+data.filename+' และยืนยันส่งโดย '+actor;
   const shipment=existing?await tx.shipment.update({where:{tracking:row.tracking},data:{orderId:order.id,status,fulfillmentStatus:'DISPATCHED',dispatchedAt,dispatchConfirmedBy:actor,dispatchEvidence:evidence}}):await tx.shipment.create({data:{tracking:row.tracking,recipient:row.recipient||order.recipient||'',phone:row.phone,address:parseOrderAddress(order.rawText??'')??order.address??'',codSatang:cod,orderId:order.id,status,importId:data.requestKey,manualImportId:data.requestKey,reportAt:dispatchedAt,fulfillmentStatus:'DISPATCHED',dispatchedAt,dispatchConfirmedBy:actor,dispatchEvidence:evidence}});
   if(order.payment==='COD')await tx.orderIntake.update({where:{id:order.id},data:{status:'MATCHED_SHIPMENT_WAITING_COD'}});
   await reconcileSalesRecognition(tx,order,shipment,actor);
   await tx.auditLog.create({data:{actor,action:'MANUAL_SHIPMENT_LINKED',entityId:order.id,details:{tracking:row.tracking,importId:data.requestKey,dispatchedAt:dispatchedAt.toISOString()}}});
  }
  await tx.manualShipmentImport.create({data:{id:data.requestKey,fingerprint,filename:data.filename,rows:data.rows,dispatchedAt,createdBy:actor}});
  return {count:data.rows.length,orderIds:data.rows.map(row=>row.orderId)};
 },55000);
}
