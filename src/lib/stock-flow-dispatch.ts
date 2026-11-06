import {db} from './db';
import {sha} from './crypto';
import {stockGoogleClient,readStockSheet} from './stock-google';
import {queueStockOrder,syncStockReservationLocked} from './stock-flow';
import {flowDispatchPlan} from './stock-flow-plan';
import {applyFlowOperation} from './stock-flow-operation';
import {saveShipmentArchive} from './stock-shipment-archive';
import type {OrderStockItem} from './order-stock-items';
import type {StockOutSnapshot} from './stock-dispatch-plan';
import {stockDispatchEligible} from './stock-dispatch-eligibility';

export async function processFlowStockDispatch(orderId:string,actor:string){
 try{return await db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
  const config=await db.stockIntegrationConfig.findUnique({where:{id:'active'}});
  if(!config?.enabled)return {status:'DISABLED'};
  let pending=await db.stockDispatch.findUnique({where:{orderId}});
  if(pending?.status==='POSTED')return {status:'POSTED',replayed:true};
  const [order,shipment]=await Promise.all([db.orderIntake.findUnique({where:{id:orderId}}),db.shipment.findUnique({where:{orderId}})]);
  const enrolled=await db.stockReservation.findUnique({where:{orderId}});
  if(enrolled&&['ALREADY_COUNTED','RECONCILING'].includes(enrolled.status))return {status:enrolled.status};
  if(!pending){
   const workflow=await db.stockWorkflow.findUnique({where:{id:'active'}});
   if(!enrolled&&workflow&&order&&(order.createdAt<workflow.activeFrom||order.eventAt<workflow.activeFrom))return {status:'NOT_ELIGIBLE'};
   if(!stockDispatchEligible(order,shipment,config.activeFrom,!!enrolled))return {status:'NOT_ELIGIBLE'};
   pending=await db.stockDispatch.upsert({where:{orderId},create:{orderId,orderNumber:order!.orderNumber,candidateTracking:shipment!.tracking,payment:order!.payment,dispatchedAt:shipment!.dispatchedAt},update:{}});
  }
  const issue=async(issues:string[],items?:OrderStockItem[])=>{
   const status=pending!.historySavedAt?'HISTORY_SAVED':issues.every(i=>i.includes('ยังไม่ระบุต้นทุนต่อ G'))?'WAITING_COST':'NEEDS_REVIEW';
   await db.stockDispatch.update({where:{orderId},data:{status,issues,...(items?{items}:{})}});return {status,issues};
  };
  const finish=async(snapshot:StockOutSnapshot,replayed:boolean,processedAt=new Date(snapshot.processedAt))=>{
   if(snapshot.orderId!==orderId||snapshot.tracking!==pending!.candidateTracking)return issue(['เลขพัสดุนี้เคยตัดสต๊อกให้ออเดอร์อื่นแล้ว']);
   const peer=await db.stockDispatch.findUnique({where:{tracking:snapshot.tracking}});
   if(peer&&peer.orderId!==orderId)return issue(['เลขพัสดุนี้มีรายการต้นทุนอยู่แล้ว']);
   // Final bookkeeping commits together; the durable sheet operation survives any rollback.
   await tx.stockDispatch.update({where:{orderId},data:{status:'POSTED',issues:[],tracking:snapshot.tracking,items:snapshot.items,totalCostSatang:snapshot.totalCostSatang,sourceSheet:snapshot.sourceSheet,dispatchedAt:new Date(snapshot.dispatchedAt),processedAt}});
   await tx.stockReservation.updateMany({where:{orderId},data:{status:'CONSUMED',issues:[]}});
   await tx.auditLog.upsert({where:{id:'stock-dispatch:'+orderId},create:{id:'stock-dispatch:'+orderId,actor,action:'STOCK_DISPATCH_COST_RECORDED',entityId:orderId,details:{orderNumber:snapshot.orderNumber,tracking:snapshot.tracking,amountSatang:snapshot.totalCostSatang,sourceSheet:snapshot.sourceSheet,dispatchedAt:snapshot.dispatchedAt,items:snapshot.items}},update:{}});
   return {status:'POSTED',replayed,totalCostSatang:snapshot.totalCostSatang};
  };
  const op=await db.stockSheetOperation.findUnique({where:{id:'dispatch:'+orderId}});
  if(op?.status==='APPLIED')return finish((op.snapshot as any).snapshot,true,op.appliedAt!);
  if(!pending.candidateTracking)return issue(['ยังไม่มีเลขพัสดุที่ผูกไว้']);
  const client=await stockGoogleClient();
  // Recover an older deployment's successful write before creating any reservation.
  const legacy=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:'cannexa-stock-out-'+sha(pending.candidateTracking),visibility:'DOCUMENT'}}]})});
  const old=legacy.matchedDeveloperMetadata?.[0]?.developerMetadata?.metadataValue;
  if(old)return finish(JSON.parse(old),true);
  if(!pending.historySavedAt){
   if(!stockDispatchEligible(order,shipment,config.activeFrom,!!enrolled))return issue(['ยังไม่เข้าเงื่อนไขออเดอร์ใหม่ที่ยืนยันจัดส่งจริง']);
   if(shipment!.tracking!==pending.candidateTracking)return issue(['เลขพัสดุเปลี่ยนหลังเริ่มประมวลผล ต้องตรวจสอบก่อน']);
   const report=await db.gmailImport.findUnique({where:{id:shipment!.importId}});
   if(report?.kind!=='SHIPMENT')return issue(['ไม่พบรายงานจัดส่งจากอีเมลที่ยืนยันแหล่งข้อมูลได้']);
   const peer=await db.stockDispatch.findUnique({where:{tracking:shipment!.tracking}});
   if(peer&&peer.orderId!==orderId)return issue(['เลขพัสดุนี้มีรายการต้นทุนอยู่แล้ว']);
   await queueStockOrder(orderId,true);
   const reserved=await syncStockReservationLocked(orderId);
   if(reserved.status!=='RESERVED')return issue(['ยังบันทึกจำนวนรอจ่ายไม่สำเร็จ ตรวจรายการในสต๊อกก่อน']);
   const reservation=await db.stockReservation.findUniqueOrThrow({where:{orderId}}),items=reservation.items as unknown as OrderStockItem[];
   const source=await readStockSheet(client),issues:string[]=[];
   for(const i of items){const p=source.products.find(p=>p.code===i.code);if(!p)issues.push('ไม่พบรหัส '+i.code);else if(p.costSatang===null)issues.push(i.code+': ยังไม่ระบุต้นทุนต่อ G');}
   if(issues.length)return issue(issues,items);
   const plan=flowDispatchPlan(items,source),savedAt=new Date();
   const costItems=items.map(i=>{
    const p=source.products.find(p=>p.code===i.code)!,change=plan.changes.find(c=>c.code===i.code)!;
    const costSatang=Number((BigInt(p.costSatang!)*BigInt(i.quantityMilliG)+500n)/1000n);
    return {...i,name:p.name,unitCostSatang:p.costSatang!,costSatang,issuedBefore:change.pendingBefore!,issuedAfter:change.pendingAfter,remainingBefore:change.remainingBefore!,remainingAfter:change.remainingAfter!};
   });
   const totalCostSatang=costItems.reduce((n,i)=>n+i.costSatang,0);
   if(!Number.isSafeInteger(totalCostSatang)||totalCostSatang>2147483647)return issue(['ต้นทุนรวมมากเกินขอบเขตที่รองรับ']);
   const snapshot:StockOutSnapshot={orderId,orderNumber:order!.orderNumber,tracking:shipment!.tracking,payment:order!.payment,dispatchedAt:shipment!.dispatchedAt!.toISOString(),processedAt:savedAt.toISOString(),sourceSheet:source.tab.title,items:costItems,totalCostSatang};
   // Commit dated history and claim the tracking number BEFORE changing stock.
   pending=await db.stockDispatch.update({where:{orderId},data:{status:'HISTORY_SAVED',historySnapshot:snapshot,historySavedAt:savedAt,tracking:snapshot.tracking,items:snapshot.items,sourceSheet:snapshot.sourceSheet,issues:[]}});
  }
  const snapshot=pending.historySnapshot as unknown as StockOutSnapshot;
  if(!snapshot||!pending.historySavedAt)throw Error('STOCK_HISTORY_MISSING');
  await saveShipmentArchive(client,snapshot,pending.historySavedAt);
  const applied=await applyFlowOperation(client,'dispatch:'+orderId,'DISPATCH',actor,async()=>{
   const source=await readStockSheet(client);
   if(source.tab.title!==snapshot.sourceSheet)throw Error('STOCK_SOURCE_CHANGED');
   const plan=flowDispatchPlan(snapshot.items,source);
   return {...plan,snapshot:{...snapshot,processedAt:new Date().toISOString(),items:snapshot.items.map(i=>{
    const c=plan.changes.find(c=>c.code===i.code)!;return {...i,issuedBefore:c.pendingBefore!,issuedAfter:c.pendingAfter,remainingBefore:c.remainingBefore!,remainingAfter:c.remainingAfter!};
   })}};
  });
  const done=await db.stockSheetOperation.findUniqueOrThrow({where:{id:'dispatch:'+orderId}});
  return finish(applied.snapshot,!!op,done.appliedAt!);
 },{timeout:55000,maxWait:10000});}
 catch{
  const row=await db.stockDispatch.findUnique({where:{orderId}});
  if(row?.status==='POSTED')return {status:'POSTED',replayed:true};
  const status=row?.historySavedAt?'HISTORY_SAVED':'NEEDS_REVIEW',issues=['ยังยืนยันการตัดสต๊อกไม่ได้ รายการที่บันทึกไว้จะใช้ต่อเมื่อประมวลผลซ้ำ'];
  await db.stockDispatch.updateMany({where:{orderId,status:{not:'POSTED'}},data:{status,issues}});return {status,issues};
 }
}
