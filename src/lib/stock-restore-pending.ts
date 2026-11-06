import {db} from './db';
import {stockGoogleClient,readStockSheet} from './stock-google';
import {applyFlowOperation} from './stock-flow-operation';
import {stockNumberCell,type FlowPlan} from './stock-flow-plan';
import {STOCK_PRECOUNTED_HEADER,STOCK_UNVERIFIED_HEADER,stockAvailableFormula} from './stock-available';

export function precountedSetupPlan(source:Awaited<ReturnType<typeof readStockSheet>>):FlowPlan{
 const header=source.rows[0]?.[14];
 if(header&&header!==STOCK_PRECOUNTED_HEADER)throw Error('STOCK_PRECOUNTED_COLUMN_IN_USE');
 if(!header&&source.rows.slice(1).some(r=>r[14]!==undefined&&r[14]!==null&&r[14]!==''))throw Error('STOCK_PRECOUNTED_COLUMN_IN_USE');
 const unknownHeader=source.rows[0]?.[15];
 if(unknownHeader&&unknownHeader!==STOCK_UNVERIFIED_HEADER)throw Error('STOCK_UNVERIFIED_COLUMN_IN_USE');
 if(!unknownHeader&&source.rows.slice(1).some(r=>r[15]!==undefined&&r[15]!==null&&r[15]!==''))throw Error('STOCK_UNVERIFIED_COLUMN_IN_USE');
 const requests:any[]=[];
 const changes=source.products.map(p=>{
  if(p.receivedQuantity===null||p.issuedQuantity===null||p.remainingQuantity===null||p.completedQuantity==null)throw Error('STOCK_QUANTITY_UNKNOWN');
  const credit=p.precountedPendingQuantity??0,unknown=p.unverifiedPendingQuantity??0;
  requests.push(stockNumberCell(source.tab.sheetId,p.sourceRow,15,unknown),stockNumberCell(source.tab.sheetId,p.sourceRow,14,credit),{updateCells:{start:{sheetId:source.tab.sheetId,rowIndex:p.sourceRow-1,columnIndex:13},rows:[{values:[{userEnteredValue:{formulaValue:stockAvailableFormula}}]}],fields:'userEnteredValue'}});
  return {code:p.code,received:p.receivedQuantity,pendingBefore:p.issuedQuantity,pendingAfter:p.issuedQuantity,remainingBefore:p.remainingQuantity,remainingAfter:p.remainingQuantity,completedBefore:p.completedQuantity,completedAfter:p.completedQuantity,precountedBefore:credit,precountedAfter:credit,unverifiedBefore:unknown,unverifiedAfter:unknown};
 });
 requests.push({updateCells:{start:{sheetId:source.tab.sheetId,rowIndex:0,columnIndex:14},rows:[{values:[{userEnteredValue:{stringValue:STOCK_PRECOUNTED_HEADER}}]}],fields:'userEnteredValue'}},{updateDimensionProperties:{range:{sheetId:source.tab.sheetId,dimension:'COLUMNS',startIndex:14,endIndex:15},properties:{hiddenByUser:true},fields:'hiddenByUser'}});
 requests.push({updateCells:{start:{sheetId:source.tab.sheetId,rowIndex:0,columnIndex:15},rows:[{values:[{userEnteredValue:{stringValue:STOCK_UNVERIFIED_HEADER}}]}],fields:'userEnteredValue'}},{updateDimensionProperties:{range:{sheetId:source.tab.sheetId,dimension:'COLUMNS',startIndex:15,endIndex:16},properties:{hiddenByUser:true},fields:'hiddenByUser'}});
 return {sourceSheet:source.tab.title,changes,requests};
}

export async function restorePendingOrders(input:{requestKey:string;orderIds:string[];precountedOrderIds:string[];reviewOrderIds:string[]},actor:string){
 const ids=[...new Set(input.orderIds)].sort(),precounted=[...new Set(input.precountedOrderIds)].sort();
 const review=[...new Set(input.reviewOrderIds)].sort();
 if(review.some(id=>!ids.includes(id)||precounted.includes(id)))throw Error('INVALID_REVIEW_ORDER');
 if(precounted.some(id=>!ids.includes(id)))throw Error('INVALID_PRECOUNTED_ORDER');
 return db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
  const rows=(await db.stockReservation.findMany({where:{orderId:{in:ids}}})).filter(r=>ids.includes(r.orderId));
  if(rows.length!==ids.length)throw Error('STOCK_RESERVATION_NOT_FOUND');
  const id='restore-pending:'+input.requestKey,previous=await db.stockSheetOperation.findUnique({where:{id}});
  if(previous){const saved=previous.snapshot as any;if(JSON.stringify(saved.orderIds)!==JSON.stringify(ids)||JSON.stringify(saved.precountedOrderIds)!==JSON.stringify(precounted)||JSON.stringify(saved.reviewOrderIds)!==JSON.stringify(review))throw Error('STOCK_REQUEST_CHANGED');}
  else if(rows.some(r=>r.status!=='ALREADY_COUNTED'))throw Error('STOCK_RESERVATION_CHANGED');
  const dispatches=await db.stockDispatch.findMany({where:{orderId:{in:ids}}});
  if(!previous&&dispatches.some(d=>ids.includes(d.orderId)&&(d.historySavedAt||d.status==='POSTED')))throw Error('STOCK_DISPATCH_ALREADY_STARTED');
  const client=await stockGoogleClient();
  const plan=await applyFlowOperation(client,id,'RESTORE_PENDING',actor,async saved=>({
   ...precountedSetupPlan(await readStockSheet(client)),orderIds:ids,precountedOrderIds:precounted,reviewOrderIds:review,
   targets:saved?.targets??rows.map(r=>({orderId:r.orderId,generation:(r.generation??0)+1,precounted:precounted.includes(r.orderId),needsReconciliation:review.includes(r.orderId)}))
  }));
  for(const target of plan.targets){
   const current=rows.find(r=>r.orderId===target.orderId)!;
   if((current.generation??0)<target.generation)await tx.stockReservation.update({where:{orderId:target.orderId},data:{status:'QUEUED',generation:target.generation,precounted:target.precounted,needsReconciliation:target.needsReconciliation,issues:[]}});
   await tx.auditLog.upsert({where:{id:'stock-restore-pending:'+target.orderId},create:{id:'stock-restore-pending:'+target.orderId,actor,action:'STOCK_PENDING_RESTORED',entityId:target.orderId,details:{orderNumber:current.orderNumber,items:current.items,precounted:target.precounted,needsReconciliation:target.needsReconciliation,reason:'ออเดอร์ยังไม่ยืนยันจัดส่ง คืนสถานะรอจ่ายและแยกยอดที่หักไว้เดิมเพื่อไม่หักซ้ำ'}},update:{}});
  }
  return {restored:ids.length,precounted:precounted.length,replayed:previous?.status==='APPLIED'};
 },{timeout:55000,maxWait:10000});
}
