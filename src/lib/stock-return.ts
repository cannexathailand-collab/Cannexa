import type {Prisma,StockReturn} from '@prisma/client';
import {db} from './db';
import {readStockSheet,stockGoogleClient} from './stock-google';
import {applyFlowOperation,recoverFlowOperation} from './stock-flow-operation';
import {flowReservationPlan} from './stock-flow-plan';
import {reservationOperationId} from './stock-flow';
import {processFlowStockDispatch} from './stock-flow-dispatch';
import {updateShipmentFulfillment} from './sales-recognition';
import {saveStockReturnArchive} from './stock-return-archive';
import {stockReturnItems,stockReturnPlan,returnedItemsAtPlan,type StockReturnSnapshot} from './stock-return-plan';
import type {OrderStockItem} from './order-stock-items';

const terminal=['POSTED','NO_STOCK_CHANGE'];
const trackingCode=(value:string)=>value.trim().toUpperCase().replace(/\s/g,'');
const json=(value:unknown)=>value as Prisma.InputJsonValue;
const values=(value:unknown)=>Array.isArray(value)?value:[];
const operationId=(tracking:string)=>'return:'+tracking;
const normalized=(value:string)=>value.normalize('NFKC').replace(/\s/g,'');
const receivedStatuses=new Set(['นำส่งคืนผู้ฝากส่งสำเร็จ','ส่งคืนถึงผู้ส่งแล้ว'].map(normalized));

function receiptEvidence(row:StockReturn){
 return values(row.evidence).some(entry=>entry&&typeof entry==='object'&&(entry.kind==='MANUAL_RECEIPT'||entry.format==='MYORDER_RETURN_TABLE'&&entry.stage==='RECEIVED'&&typeof entry.statusText==='string'&&receivedStatuses.has(normalized(entry.statusText))));
}
function assertSnapshot(snapshot:StockReturnSnapshot,row:StockReturn){
 if(!snapshot||snapshot.returnId!==row.id||snapshot.tracking!==row.tracking||!snapshot.orderId||row.orderId&&snapshot.orderId!==row.orderId||!snapshot.dispatchId)throw Error('STOCK_RETURN_IDENTITY_MISMATCH');
 stockReturnItems(snapshot.items,snapshot.totalCostSatang);
 if(!Number.isFinite(+new Date(snapshot.receivedAt)))throw Error('STOCK_RETURN_DATE_INVALID');
}
async function review(tracking:string,issue:string){
 await db.stockReturn.updateMany({where:{tracking,status:{notIn:terminal}},data:{status:'NEEDS_REVIEW',issues:[issue]}});
 return {status:'NEEDS_REVIEW',issues:[issue]};
}

// Sales/order locks must finish before taking the stock-sheet lock. Transit-only
// notices never close an order or release its pending stock.
async function prepareReceivedReturn(row:StockReturn,actor:string){
 const [workflow,shipment]=await Promise.all([db.stockWorkflow.findUnique({where:{id:'active'}}),db.shipment.findUnique({where:{tracking:row.tracking}})]);
 if(!workflow?.enabled||!shipment?.orderId||row.orderId&&row.orderId!==shipment.orderId)throw Error('STOCK_RETURN_ORDER_UNMATCHED');
 const order=await db.orderIntake.findUnique({where:{id:shipment.orderId}});
 if(!order||!receiptEvidence(row))throw Error('STOCK_RETURN_RECEIPT_UNCONFIRMED');
 const at=row.receivedAt??row.reportedAt,earliest=shipment.dispatchedAt??shipment.reportAt;
 if(!Number.isFinite(+row.reportedAt)||!Number.isFinite(+at)||row.reportedAt<workflow.activeFrom||row.reportedAt<order.eventAt||row.reportedAt<earliest||at<earliest||+at>Date.now()+300000||+row.reportedAt>Date.now()+300000)throw Error('STOCK_RETURN_DATE_INVALID');
 const evidence='รับสินค้าตีกลับตามรายงาน/การยืนยันรับคืน · '+row.tracking+' · '+at.toISOString();
 await updateShipmentFulfillment(order.id,'RETURNED',actor,evidence);
 const dispatch=await db.stockDispatch.findUnique({where:{orderId:order.id}});
 // The guarded outbound processor also recognizes older native-only markers.
 // A legacy lost response need not have a StockSheetOperation or saved history.
 if(dispatch&&dispatch.status!=='POSTED')await processFlowStockDispatch(order.id,actor);
}

export async function processStockReturn(tracking:string,actor:string){
 const code=trackingCode(tracking);
 try{
  const initial=await db.stockReturn.findUnique({where:{tracking:code}});
  if(!initial)return {status:'NOT_FOUND'};
  if(terminal.includes(initial.status))return {status:initial.status,replayed:true};
  if(initial.stage!=='RECEIVED')return {status:'IN_TRANSIT'};
  // A durable return operation was already authorized against a frozen history.
  // Recover it even if unrelated live metadata has changed since the first try.
  const existing=await db.stockSheetOperation.findUnique({where:{id:operationId(code)}});
  if(!existing)await prepareReceivedReturn(initial,actor);
  return await db.$transaction(async tx=>{
   await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
   let row=await db.stockReturn.findUniqueOrThrow({where:{tracking:code}});
   if(terminal.includes(row.status))return {status:row.status,replayed:true};
   if(row.stage!=='RECEIVED')return {status:'IN_TRANSIT'};
   const finish=async(snapshot:StockReturnSnapshot,replayed:boolean,processedAt:Date)=>{
    assertSnapshot(snapshot,row);
    await tx.stockReturn.update({where:{tracking:code},data:{orderId:snapshot.orderId,status:'POSTED',issues:[],items:json(snapshot.items),sourceSheet:snapshot.sourceSheet,totalCostSatang:snapshot.totalCostSatang,receivedAt:new Date(snapshot.receivedAt),processedAt}});
    await tx.auditLog.upsert({where:{id:'stock-return:'+code},create:{id:'stock-return:'+code,actor,action:'STOCK_RETURN_POSTED',entityId:snapshot.orderId,details:json({...snapshot,amountSatang:-snapshot.totalCostSatang})},update:{}});
    return {status:'POSTED',replayed,totalCostSatang:snapshot.totalCostSatang};
   };
   const operation=await db.stockSheetOperation.findUnique({where:{id:operationId(code)}});
   if(operation?.status==='APPLIED')return finish((operation.snapshot as any).snapshot,true,operation.appliedAt??new Date());
   if(operation&&!row.historySavedAt)throw Error('STOCK_RETURN_DISPATCH_UNCERTAIN');
   let client:Awaited<ReturnType<typeof stockGoogleClient>>|undefined;
   if(operation){
    client=await stockGoogleClient();
    const recovered=await recoverFlowOperation(client,operationId(code));
    if(recovered){const applied=await db.stockSheetOperation.findUniqueOrThrow({where:{id:operationId(code)}});return finish(recovered.snapshot,true,applied.appliedAt??new Date());}
   }
   const shipment=await db.shipment.findUnique({where:{tracking:code}});
   if(!shipment?.orderId||row.orderId&&row.orderId!==shipment.orderId)throw Error('STOCK_RETURN_ORDER_UNMATCHED');
   const orderId=shipment.orderId,dispatch=await db.stockDispatch.findUnique({where:{orderId}});
   if(dispatch&&(dispatch.tracking&&dispatch.tracking!==code||dispatch.candidateTracking&&dispatch.candidateTracking!==code))throw Error('STOCK_RETURN_IDENTITY_MISMATCH');
   const dispatchOperation=await db.stockSheetOperation.findUnique({where:{id:'dispatch:'+orderId}});
   if(!dispatch||dispatch.status!=='POSTED'){
    if(dispatch?.historySavedAt||dispatchOperation||operation||row.historySavedAt)throw Error('STOCK_RETURN_DISPATCH_UNCERTAIN');
    const reservation=await db.stockReservation.findUnique({where:{orderId}});
    if(reservation&&(reservation.precounted||reservation.needsReconciliation||!['QUEUED','RESERVED','RELEASED'].includes(reservation.status)))throw Error('STOCK_RETURN_DISPATCH_UNCERTAIN');
    if(reservation&&reservation.status!=='RELEASED'){
     const reserveOperation=await db.stockSheetOperation.findUnique({where:{id:reservationOperationId(reservation)}});
     if(reservation.status==='QUEUED'&&reserveOperation||reservation.status==='RESERVED'&&reserveOperation?.status!=='APPLIED')throw Error('STOCK_RETURN_DISPATCH_UNCERTAIN');
     if(reservation.status==='RESERVED'){
      client??=await stockGoogleClient();
      // Share the ordinary cancellation/release identity: either worker may
      // resume after Sheets succeeds but the reservation transaction fails.
      await applyFlowOperation(client,'release:'+orderId,'RELEASE',actor,async()=>flowReservationPlan(reservation.items as unknown as OrderStockItem[],await readStockSheet(client),true));
     }
     await tx.stockReservation.update({where:{orderId},data:{status:'RELEASED',issues:[]}});
    }
    if(dispatch)await tx.stockDispatch.update({where:{orderId},data:{status:'EXCLUDED',issues:['รับคืนโดยไม่มีรายการตัดสต๊อกเดิม จึงไม่เพิ่มสต๊อก']}});
    await tx.stockReturn.update({where:{tracking:code},data:{orderId,status:'NO_STOCK_CHANGE',items:[],totalCostSatang:0,receivedAt:row.receivedAt??row.reportedAt,processedAt:new Date(),issues:[]}});
    await tx.auditLog.upsert({where:{id:'stock-return:'+code},create:{id:'stock-return:'+code,actor,action:'STOCK_RETURN_NO_STOCK_CHANGE',entityId:orderId,details:{tracking:code,reason:'ไม่พบการตัดสต๊อกเดิม คืนเฉพาะจำนวนรอจ่ายที่ยืนยันได้ ไม่เพิ่มสินค้าหรือลดต้นทุน'}},update:{}});
    return {status:'NO_STOCK_CHANGE'};
   }
   if(dispatch.tracking!==code)throw Error('STOCK_RETURN_IDENTITY_MISMATCH');
   client??=await stockGoogleClient();
   if(!row.historySavedAt){
    const items=stockReturnItems(dispatch.items,dispatch.totalCostSatang),source=await readStockSheet(client),plan=stockReturnPlan(items,source),now=new Date();
    const snapshot:StockReturnSnapshot={returnId:row.id,dispatchId:dispatch.id,orderId,orderNumber:dispatch.orderNumber,tracking:code,sourceSheet:source.tab.title,receivedAt:(row.receivedAt??row.reportedAt).toISOString(),reportedAt:row.reportedAt.toISOString(),processedAt:now.toISOString(),dateBasis:row.receivedAt?'RECEIVED_AT':'EMAIL_REPORT_RECEIVED_AT',evidence:values(row.evidence),items:returnedItemsAtPlan(items,plan),totalCostSatang:dispatch.totalCostSatang!};
    // Persist before Sheets so an archive/write failure cannot discard evidence.
    row=await db.stockReturn.update({where:{tracking:code},data:{orderId,status:'PENDING',historySnapshot:json(snapshot),historySavedAt:now,items:json(snapshot.items),sourceSheet:snapshot.sourceSheet,totalCostSatang:snapshot.totalCostSatang,issues:[]}});
   }
   const snapshot=row.historySnapshot as unknown as StockReturnSnapshot;
   assertSnapshot(snapshot,row);
   if(snapshot.dispatchId!==dispatch.id||snapshot.orderId!==orderId)throw Error('STOCK_RETURN_IDENTITY_MISMATCH');
   await saveStockReturnArchive(client,snapshot,row.historySavedAt!);
   const applied=await applyFlowOperation(client,operationId(code),'RETURN',actor,async()=>{
    const source=await readStockSheet(client);if(source.tab.title!==snapshot.sourceSheet)throw Error('STOCK_SOURCE_CHANGED');
    const plan=stockReturnPlan(snapshot.items,source);
    return {...plan,snapshot:{...snapshot,processedAt:new Date().toISOString(),items:returnedItemsAtPlan(snapshot.items,plan)}};
   });
   const done=await db.stockSheetOperation.findUniqueOrThrow({where:{id:operationId(code)}});
   return finish(applied.snapshot,!!operation,done.appliedAt??new Date());
  },{timeout:55000,maxWait:10000});
 }catch(error){
  const current=await db.stockReturn.findUnique({where:{tracking:code}});
  if(current&&terminal.includes(current.status))return {status:current.status,replayed:true};
  if(!current)throw error;
  const message=error instanceof Error?error.message:'';
  const issues:Record<string,string>={STOCK_RETURN_ORDER_UNMATCHED:'ยังจับคู่เลขพัสดุกับออเดอร์เดิมไม่ได้ ต้องตรวจสอบก่อนคืนสต๊อก',STOCK_RETURN_RECEIPT_UNCONFIRMED:'ยังไม่มีหลักฐานยืนยันว่ารับสินค้าคืนครบแล้ว',STOCK_RETURN_DATE_INVALID:'วันที่รายงานหรือวันที่รับคืนไม่สอดคล้องกับออเดอร์เดิม',STOCK_RETURN_IDENTITY_MISMATCH:'เลขพัสดุหรือออเดอร์ไม่ตรงกับประวัติเดิม',STOCK_RETURN_DISPATCH_UNCERTAIN:'ยังยืนยันผลตัดสต๊อกเดิมไม่ได้ ตรวจสอบก่อนเพื่อไม่คืนซ้ำ',STOCK_RETURN_ITEMS_INVALID:'รายละเอียดสินค้าในประวัติตัดสต๊อกเดิมไม่ครบหรือซ้ำกัน',STOCK_RETURN_COST_MISMATCH:'ต้นทุนสินค้าในประวัติเดิมไม่ตรงกัน',STOCK_BALANCE_MISMATCH:'ยอดรับ ตัดสะสม และคงเหลือในชีตไม่สัมพันธ์กัน',STOCK_SOURCE_CHANGED:'ชีตสต๊อกเปลี่ยนระหว่างรับคืน ต้องตรวจสอบก่อน'};
  return review(code,message.startsWith('STOCK_PRODUCT_NOT_FOUND ')?'ไม่พบสินค้า '+message.slice('STOCK_PRODUCT_NOT_FOUND '.length)+' ในสต๊อกปัจจุบัน':message.startsWith('STOCK_QUANTITY_UNKNOWN ')?'จำนวนรับหรือคงเหลือของสินค้า '+message.slice('STOCK_QUANTITY_UNKNOWN '.length)+' ยังไม่ระบุ':issues[message]??'ยังยืนยันการคืนสต๊อกไม่ได้ เก็บประวัติเดิมไว้แล้วและลองรายการเดิมได้');
 }
}

export async function processPendingStockReturns(actor:string,limit=1){
 const take=Number.isSafeInteger(limit)?Math.max(1,Math.min(limit,100)):1;
 const rows=await db.stockReturn.findMany({where:{stage:'RECEIVED',status:{in:['PENDING','NEEDS_REVIEW']}},orderBy:[{updatedAt:'asc'},{tracking:'asc'}],take});
 let posted=0,noStockChange=0;
 for(const row of rows){const result=await processStockReturn(row.tracking,actor);if(result.status==='POSTED')posted++;if(result.status==='NO_STOCK_CHANGE')noStockChange++;}
 return {processed:rows.length,posted,noStockChange};
}

export async function confirmStockReturnReceived(tracking:string,actor:string){
 const code=trackingCode(tracking);
 return db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
  const row=await tx.stockReturn.findUnique({where:{tracking:code}});if(!row)throw Error('STOCK_RETURN_NOT_FOUND');
  if(terminal.includes(row.status)||row.stage==='RECEIVED')return {status:row.status,replayed:true};
  const now=new Date(),evidence={kind:'MANUAL_RECEIPT',actor,receivedAt:now.toISOString()};
  await tx.stockReturn.update({where:{tracking:code},data:{stage:'RECEIVED',status:'PENDING',receivedAt:now,evidence:json([...values(row.evidence),evidence]),issues:[]}});
  await tx.auditLog.upsert({where:{id:'stock-return-received:'+code},create:{id:'stock-return-received:'+code,actor,action:'STOCK_RETURN_RECEIVED_CONFIRMED',entityId:row.orderId??code,details:{tracking:code,receivedAt:now.toISOString()}},update:{}});
  return {status:'PENDING',stage:'RECEIVED'};
 },{timeout:15000,maxWait:10000});
}
