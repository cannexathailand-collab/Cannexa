import {prepareStockDailyClose} from './stock-history';
import {processMetaPurchases} from './meta-purchase';
import {processAdditionalCommissions} from './additional-commission';
import {db} from './db';import {sha} from './crypto';import {stockGoogleClient,readStockSheet} from './stock-google';import {orderStockItems} from './order-stock-items';import {stockDispatchPlan,type StockOutSnapshot} from './stock-dispatch-plan';
import {stockDispatchEligible} from './stock-dispatch-eligibility';
export {stockDispatchEligible} from './stock-dispatch-eligibility';
import {processFlowStockDispatch} from './stock-flow-dispatch';
import {processPendingReservations} from './stock-flow';
import {matchShipments} from './gmail-reports';
import {confirmReportedShipments} from './shipment-report-confirmation';
import {enqueueStockDispatches} from './stock-dispatch-worker';
import {enqueuePendingStockReturns} from './stock-return-worker';
const message=(e:unknown)=>e instanceof Error&&['STOCK_NOT_CONNECTED','STOCK_SHEETS_API_DISABLED','STOCK_SHEET_PERMISSION_DENIED','STOCK_FEDERATION_PERMISSION_DENIED'].includes(e.message)?'ยังเชื่อมข้อมูลสต๊อกไม่ได้ กรุณาตรวจการเชื่อม Google Sheets':'ยังยืนยันการตัดสต๊อกไม่ได้ กดประมวลผลซ้ำได้โดยไม่ตัดซ้ำ';
export async function processStockDispatch(orderId:string,actor:string){
 const workflow=await db.stockWorkflow.findUnique({where:{id:'active'}});if(workflow?.enabled)return processFlowStockDispatch(orderId,actor);
 const config=await db.stockIntegrationConfig.findUnique({where:{id:'active'}});if(!config?.enabled)return {status:'DISABLED'};
 const previous=await db.stockDispatch.findUnique({where:{orderId}});if(previous?.status==='WAITING_SHIPMENT')return {status:'WAITING_SHIPMENT'};if(previous?.status==='POSTED')return {status:'POSTED',replayed:true};
 const [order,shipment]=await Promise.all([db.orderIntake.findUnique({where:{id:orderId}}),db.shipment.findUnique({where:{orderId}})]);
 if(!previous){if(!stockDispatchEligible(order,shipment,config.activeFrom))return {status:'NOT_ELIGIBLE'};await db.stockDispatch.upsert({where:{orderId},create:{orderId,orderNumber:order!.orderNumber,candidateTracking:shipment!.tracking,payment:order!.payment,dispatchedAt:shipment!.dispatchedAt},update:{}});}
 try{return await db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
  if((await db.stockWorkflow.findUnique({where:{id:'active'}}))?.enabled)throw Error('STOCK_FLOW_SWITCHED');
  const pending=await tx.stockDispatch.findUniqueOrThrow({where:{orderId}});if(pending.status==='POSTED')return {status:'POSTED',replayed:true};
  const issue=async(reason:string[],items?:unknown)=>{const status=reason.every(s=>s.includes('ยังไม่ระบุต้นทุนต่อ G'))?'WAITING_COST':'NEEDS_REVIEW';await tx.stockDispatch.update({where:{id:pending.id},data:{status,issues:reason,...(items?{items:items as import('@prisma/client').Prisma.InputJsonValue}:{})}});return {status,issues:reason};};
  if(!pending.candidateTracking)return issue(['ยังไม่มีเลขพัสดุที่ผูกไว้']);
  const client=await stockGoogleClient(),key='cannexa-stock-out-'+sha(pending.candidateTracking);
  const posted=await client('/developerMetadata:search',{method:'POST',body:JSON.stringify({dataFilters:[{developerMetadataLookup:{metadataKey:key,visibility:'DOCUMENT'}}]})});
  const raw=posted.matchedDeveloperMetadata?.[0]?.developerMetadata?.metadataValue;
  const finish=async(snapshot:StockOutSnapshot,replayed:boolean)=>{
   if(snapshot.orderId!==orderId||snapshot.tracking!==pending.candidateTracking)return issue(['เลขพัสดุนี้เคยตัดสต๊อกให้ออเดอร์อื่นแล้ว ต้องตรวจสอบก่อน']);
   const peer=await tx.stockDispatch.findUnique({where:{tracking:snapshot.tracking}});if(peer&&peer.orderId!==orderId)return issue(['เลขพัสดุนี้มีรายการต้นทุนอยู่แล้ว']);
   await tx.stockDispatch.update({where:{id:pending.id},data:{status:'POSTED',issues:[],tracking:snapshot.tracking,items:snapshot.items,totalCostSatang:snapshot.totalCostSatang,sourceSheet:snapshot.sourceSheet,dispatchedAt:new Date(snapshot.dispatchedAt),processedAt:new Date(snapshot.processedAt)}});
   await tx.auditLog.upsert({where:{id:'stock-dispatch:'+orderId},create:{id:'stock-dispatch:'+orderId,actor,action:'STOCK_DISPATCH_COST_RECORDED',entityId:orderId,details:{orderNumber:snapshot.orderNumber,tracking:snapshot.tracking,amountSatang:snapshot.totalCostSatang,sourceSheet:snapshot.sourceSheet,dispatchedAt:snapshot.dispatchedAt,items:snapshot.items}},update:{}});
   return {status:'POSTED',replayed,totalCostSatang:snapshot.totalCostSatang};
  };
  if(raw)return finish(JSON.parse(raw) as StockOutSnapshot,true);
  if(await tx.stockReturn.findFirst({where:{OR:[{orderId},{tracking:pending.candidateTracking}]},select:{id:true}})){
   await tx.stockDispatch.update({where:{id:pending.id},data:{status:'EXCLUDED',issues:['มีรายการตีกลับ จึงหยุดการตัดสต๊อกที่ยังไม่สำเร็จ']}});return {status:'RETURN_IN_PROGRESS'};
  }
  const [current,currentShipment,currentConfig]=await Promise.all([tx.orderIntake.findUnique({where:{id:orderId}}),tx.shipment.findUnique({where:{orderId}}),tx.stockIntegrationConfig.findUnique({where:{id:'active'}})]);
  if(!currentConfig?.enabled||!stockDispatchEligible(current,currentShipment,currentConfig.activeFrom)){await tx.stockDispatch.update({where:{id:pending.id},data:{status:'EXCLUDED',issues:['ยังไม่เข้าเงื่อนไขออเดอร์ใหม่ที่ยืนยันจัดส่งจริง']}});return {status:'EXCLUDED'};}
  if(currentShipment!.tracking!==pending.candidateTracking)return issue(['เลขพัสดุเปลี่ยนหลังเริ่มประมวลผล ต้องตรวจสอบก่อน']);
  const sourceReport=await tx.gmailImport.findUnique({where:{id:currentShipment!.importId}});if(sourceReport?.kind!=='SHIPMENT')return issue(['ไม่พบรายงานจัดส่งจากอีเมลที่ยืนยันแหล่งข้อมูลได้']);
  const stored=Array.isArray(pending.items)?pending.items as {code:string;quantityMilliG:number}[]:[];
  const parsed=stored.length?{items:stored,issues:[]}:orderStockItems(current!.rawText);if(parsed.issues.length)return issue(parsed.issues);
  const source=await readStockSheet(client),known=parsed.items.map(item=>source.products.find(p=>p.code===item.code)).filter(Boolean);
  const params=new URLSearchParams({valueRenderOption:'FORMULA'});for(const product of known)params.append('ranges',"'"+source.tab.title+"'!F"+product!.sourceRow+':G'+product!.sourceRow);
  const values=known.length?await client('/values:batchGet?'+params):{valueRanges:[]},formulas=new Map<string,{issued?:string;remaining?:string}>();
  known.forEach((product,index)=>{const cells=values.valueRanges?.[index]?.values?.[0]??[];formulas.set(product!.code,{issued:typeof cells[0]==='string'?cells[0]:undefined,remaining:typeof cells[1]==='string'?cells[1]:undefined});});
  const plan=stockDispatchPlan(current!,{tracking:currentShipment!.tracking,dispatchedAt:currentShipment!.dispatchedAt!},parsed.items,source,formulas,key);if(plan.issues.length||!plan.snapshot)return issue(plan.issues,parsed.items);
  await prepareStockDailyClose(client,actor);
 await client(':batchUpdate',{method:'POST',body:JSON.stringify({requests:plan.requests})});
  const after=await readStockSheet(client);if(plan.snapshot.items.some(item=>{const product=after.products.find(p=>p.code===item.code);return !product||product.issuedQuantity!==item.issuedAfter||product.remainingQuantity!==item.remainingAfter;}))throw Error('STOCK_OUT_NOT_CONFIRMED');
  return finish(plan.snapshot,false);
 },{timeout:55000,maxWait:10000});}catch(e){if(e instanceof Error&&e.message==='STOCK_FLOW_SWITCHED')return processStockDispatch(orderId,actor);const issues=[message(e)];await db.stockDispatch.updateMany({where:{orderId,status:{not:'POSTED'}},data:{status:'NEEDS_REVIEW',issues}});return {status:'NEEDS_REVIEW',issues};}
}
export async function processPendingStockDispatches(actor:string,limit=1,priorityCode?:string){
 const config=await db.stockIntegrationConfig.findUnique({where:{id:'active'}});if(!config?.enabled)return {processed:0,posted:0};
 await enqueuePendingStockReturns().catch(()=>{});
 await matchShipments(actor);
 const confirmation=await confirmReportedShipments(actor);
 await processPendingReservations(1).catch(()=>{});
 const pending=await db.stockDispatch.findMany({where:{status:{in:['PENDING','NEEDS_REVIEW','WAITING_COST','HISTORY_SAVED']}},orderBy:{updatedAt:'asc'},take:100});
 if(priorityCode)pending.sort((a,b)=>Number(Array.isArray(b.items)&&b.items.some((i:any)=>i.code===priorityCode))-Number(Array.isArray(a.items)&&a.items.some((i:any)=>i.code===priorityCode)));
 const workflow=await db.stockWorkflow.findUnique({where:{id:'active'}}),activeFrom=workflow?.enabled&&workflow.activeFrom>config.activeFrom?workflow.activeFrom:config.activeFrom;
 const candidates=await db.$queryRaw<{orderId:string}[]>`SELECT s."orderId" FROM "Shipment" s JOIN "OrderIntake" o ON o.id=s."orderId" LEFT JOIN "StockDispatch" d ON d."orderId"=o.id LEFT JOIN "StockReservation" r ON r."orderId"=o.id WHERE (r.status IS NULL OR r.status NOT IN ('ALREADY_COUNTED','RECONCILING')) AND (o."createdAt">=${activeFrom} AND o."eventAt">=${activeFrom} OR r."orderId" IS NOT NULL) AND s."dispatchedAt">=${activeFrom} AND s."fulfillmentStatus"='DISPATCHED' AND o.status NOT IN ('CANCELLED','WITHDRAWN','EXPIRED','RETURNED') AND s.status NOT IN ('CANCELLED','WITHDRAWN','RETURNED') AND (d.id IS NULL OR d.status NOT IN ('POSTED','EXCLUDED')) ORDER BY s."dispatchedAt" ASC LIMIT 100`;
 const ids=[...new Set([...pending.map(p=>p.orderId),...candidates.map(p=>p.orderId!)])];const completed=ids.length?await db.stockDispatch.findMany({where:{orderId:{in:ids},status:{in:['POSTED','EXCLUDED']}},select:{orderId:true}}):[];const done=new Set(completed.map(p=>p.orderId));let processed=0,posted=0;
 const ready=ids.filter(id=>!done.has(id)&&!confirmation.failedOrderIds.includes(id));
 for(const id of ready.slice(0,limit)){const result=await processStockDispatch(id,actor);processed++;if(result.status==='POSTED')posted++;}
 await enqueueStockDispatches(ready.slice(limit));
 await processAdditionalCommissions().catch(()=>{});
 await processMetaPurchases().catch(()=>{});
 return {processed,posted};
}
