import {createHash,randomInt} from 'node:crypto';
import {db} from './db';
import {readStockSheet,stockGoogleClient} from './stock-google';
import {flowBaselinePlan,flowReservationPlan} from './stock-flow-plan';
import {applyFlowOperation} from './stock-flow-operation';
import {orderStockItems,type OrderStockItem} from './order-stock-items';
import {bangkokDay} from './sales-dates';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const reservationOperationId=(r:{orderId:string;generation?:number})=>'reserve:'+r.orderId+(r.generation?':'+r.generation:'');
export async function activateStockFlow(actor:string){
 return db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
  const existing=await db.stockWorkflow.findUnique({where:{id:'active'}});if(existing?.enabled)return {enabled:true,replayed:true};
  const client=await stockGoogleClient();
  const saved=await applyFlowOperation(client,'baseline-v1','BASELINE',actor,async previous=>{
   const source=await readStockSheet(client),fingerprint=hash(source.products);
   if(previous&&previous.baselineFingerprint!==fingerprint)throw Error('STOCK_BASELINE_CHANGED');
   const rows=source.rows.slice(0,Math.max(2,...source.products.map(p=>p.sourceRow))).map(row=>Array.from({length:12},(_,i)=>row[i]??''));
   const now=new Date(),archive=previous?.archive??{sheetId:randomInt(1,2_000_000_000),sheetTitle:'ก่อนเริ่มรอบ '+bangkokDay(now),rows,fingerprint:hash(rows)};
   return {...flowBaselinePlan(source),baselineFingerprint:fingerprint,before:source.products,archive,capturedAt:now.toISOString()};
  });
  const integration=await db.stockIntegrationConfig.findUnique({where:{id:'active'}});
  const activeFrom=integration?.enabled?integration.activeFrom:new Date(saved.capturedAt);
  await db.stockWorkflow.upsert({where:{id:'active'},create:{id:'active',enabled:true,sourceSheet:saved.sourceSheet,activeFrom},update:{enabled:true,sourceSheet:saved.sourceSheet}});
  await db.auditLog.upsert({where:{id:'stock-flow-baseline'},create:{id:'stock-flow-baseline',actor,action:'STOCK_FLOW_ACTIVATED',entityId:'stock',details:{sourceSheet:saved.sourceSheet,historySheet:saved.archive.sheetTitle,count:saved.before.length}},update:{}});
  return {enabled:true,replayed:false,archiveSheetId:saved.archive.sheetId};
 },{timeout:55000,maxWait:10000});
}
export async function queueStockOrder(orderId:string,force=false){
 const config=await db.stockWorkflow.findUnique({where:{id:'active'}});if(!config?.enabled)return null;
 const previous=await db.stockReservation.findUnique({where:{orderId}});if(previous)return previous;
 const posted=await db.stockDispatch.findUnique({where:{orderId}});if(posted?.status==='POSTED')return null;
 const order=await db.orderIntake.findUnique({where:{id:orderId}});if(!order||(!force&&(order.createdAt<config.activeFrom||order.eventAt<config.activeFrom)))return null;
 if(['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(order.status))return null;
 const parsed=orderStockItems(order.rawText);
 return db.stockReservation.upsert({where:{orderId},create:{orderId,messageKey:order.messageKey,orderNumber:order.orderNumber,actor:order.sellerUsername??'line-order',items:parsed.items,issues:parsed.issues},update:{}});
}
export async function syncStockReservation(orderId:string){
 return db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
  return syncStockReservationLocked(orderId);
 },{timeout:55000,maxWait:10000});
}
// The caller holds the shared stock-sheet-add lock.
export async function syncStockReservationLocked(orderId:string){
  const config=await db.stockWorkflow.findUnique({where:{id:'active'}});if(!config?.enabled)return {status:'DISABLED'};
  const reservation=await db.stockReservation.findUnique({where:{orderId}});if(!reservation)return {status:'NOT_FOUND'};
  if(['CONSUMED','RELEASED','ALREADY_COUNTED','RECONCILING'].includes(reservation.status))return {status:reservation.status};
  const order=await db.orderIntake.findUnique({where:{id:orderId}}),shipment=await db.shipment.findUnique({where:{orderId}});
  const release=!order||['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(order.status)||shipment?.fulfillmentStatus==='CANCELLED';
  const client=await stockGoogleClient();
  const pending=await db.stockSheetOperation.findUnique({where:{id:reservationOperationId(reservation)}});
  if(reservation.status==='QUEUED'&&(!release||pending)){
   const parsed=(reservation.items as unknown as OrderStockItem[]).length?{items:reservation.items as unknown as OrderStockItem[],issues:[]}:orderStockItems(order?.rawText??null);
   if(parsed.issues.length){await db.stockReservation.update({where:{orderId},data:{issues:parsed.issues}});return {status:'NEEDS_REVIEW'};}
   try{
    await applyFlowOperation(client,reservationOperationId(reservation),'RESERVE',reservation.actor,async()=>{const source=await readStockSheet(client);if(source.tab.title!==config.sourceSheet)throw Error('STOCK_SOURCE_CHANGED');return flowReservationPlan(parsed.items,source,false,reservation.precounted,reservation.needsReconciliation);});
    await db.stockReservation.update({where:{orderId},data:{status:'RESERVED',items:parsed.items,issues:[]}});
    await db.auditLog.upsert({where:{id:'stock-reserve:'+orderId},create:{id:'stock-reserve:'+orderId,actor:reservation.actor,action:'STOCK_RESERVED',entityId:orderId,details:{orderNumber:reservation.orderNumber,items:parsed.items}},update:{}});
   }catch(error){const message=error instanceof Error?error.message:'';const missing=message.startsWith('STOCK_PRODUCT_NOT_FOUND ')?message.slice('STOCK_PRODUCT_NOT_FOUND '.length):null;const unknown=message.startsWith('STOCK_QUANTITY_UNKNOWN ')?message.slice('STOCK_QUANTITY_UNKNOWN '.length):null;const issue=unknown?'รหัส '+unknown+' ยังไม่ระบุจำนวนรับหรือคงเหลือ กรุณาเติมข้อมูลสต๊อกก่อน':missing?'ไม่พบรหัส '+missing+' ในชีตสต๊อก กรุณาตรวจรหัสหรือเพิ่มสินค้าก่อน':'ยังบันทึกจำนวนรอจ่ายไม่ได้ ตรวจข้อมูลสต๊อกและการเชื่อมต่อ แล้วลองใหม่';await db.stockReservation.update({where:{orderId},data:{issues:[issue]}});return {status:'NEEDS_REVIEW'};}
  }
  if(release){
   if(reservation.needsReconciliation)return {status:"NEEDS_RECONCILIATION"};
   const current=await db.stockReservation.findUniqueOrThrow({where:{orderId}});
   const dispatch=await db.stockDispatch.findUnique({where:{orderId}});
   if(dispatch?.historySavedAt)return {status:'DISPATCH_IN_PROGRESS'};
   if(current.status==='RESERVED'){
    await applyFlowOperation(client,'release:'+orderId,'RELEASE',reservation.actor,async()=>flowReservationPlan(current.items as unknown as OrderStockItem[],await readStockSheet(client),true,reservation.precounted));
    await db.auditLog.upsert({where:{id:'stock-release:'+orderId},create:{id:'stock-release:'+orderId,actor:'line-unsend',action:'STOCK_RESERVATION_RELEASED',entityId:orderId,details:{orderNumber:reservation.orderNumber,items:current.items}},update:{}});
   }
   await db.stockReservation.update({where:{orderId},data:{status:'RELEASED',issues:[]}});
   return {status:'RELEASED'};
  }
  return {status:'RESERVED'};
}
export async function processPendingReservations(limit=2){
 const config=await db.stockWorkflow.findUnique({where:{id:'active'}});if(!config?.enabled)return;
 const candidates=await db.$queryRawUnsafe<{id:string}[]>('SELECT o.id FROM "OrderIntake" o LEFT JOIN "StockReservation" r ON r."orderId"=o.id LEFT JOIN "StockDispatch" d ON d."orderId"=o.id WHERE r."orderId" IS NULL AND (d.status IS NULL OR d.status<>\'POSTED\') AND o."createdAt">=$1 AND o."eventAt">=$1 AND o.status NOT IN (\'CANCELLED\',\'WITHDRAWN\',\'EXPIRED\',\'RETURNED\') ORDER BY o."createdAt" LIMIT 10',config.activeFrom);
 for(const order of candidates)await queueStockOrder(order.id);
 const orphaned=await db.$queryRawUnsafe<{orderId:string}[]>('SELECT r."orderId" FROM "StockReservation" r LEFT JOIN "OrderIntake" o ON o.id=r."orderId" LEFT JOIN "StockDispatch" d ON d."orderId"=r."orderId" WHERE d."historySavedAt" IS NULL AND r.status IN (\'QUEUED\',\'RESERVED\') AND (o.id IS NULL OR o.status IN (\'CANCELLED\',\'WITHDRAWN\',\'EXPIRED\',\'RETURNED\')) ORDER BY r."updatedAt" LIMIT 10');
 const queued=await db.stockReservation.findMany({where:{status:'QUEUED'},orderBy:{updatedAt:'asc'},take:limit});
 for(const id of [...new Set([...orphaned.map(r=>r.orderId),...queued.map(r=>r.orderId)])].slice(0,limit))await syncStockReservation(id).catch(()=>{});
}
export async function assertNoStockReservations(codes:string[]){
 const rows=await db.stockReservation.findMany({where:{status:{in:['QUEUED','RESERVED']}},select:{items:true}});
 if(rows.some(r=>Array.isArray(r.items)&&r.items.some((i:any)=>codes.includes(i.code))))throw Error('STOCK_HAS_PENDING_ORDERS');
}
