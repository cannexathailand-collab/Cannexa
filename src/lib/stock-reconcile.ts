import {db} from './db';
import {applyFlowOperation} from './stock-flow-operation';
import {stockGoogleClient,readStockSheet} from './stock-google';
import {flowReservationPlan,milli} from './stock-flow-plan';
import type {OrderStockItem} from './order-stock-items';
export async function reconcileAlreadyCounted(input:{requestKey:string;orderIds:string[]},actor:string){
 const ids=[...new Set(input.orderIds)].sort();
 return db.$transaction(async tx=>{
  await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','stock-sheet-add');
  const reservations=(await db.stockReservation.findMany({where:{orderId:{in:ids}}})).filter(r=>ids.includes(r.orderId));
  if(reservations.length!==ids.length)throw Error('STOCK_RESERVATION_NOT_FOUND');
  const dispatches=await db.stockDispatch.findMany({where:{orderId:{in:ids}}});
  if(dispatches.some(d=>ids.includes(d.orderId)&&(d.historySavedAt||d.status==='POSTED')))throw Error('STOCK_DISPATCH_ALREADY_STARTED');
  const id='already-counted:'+input.requestKey,previous=await db.stockSheetOperation.findUnique({where:{id}});
  if(previous&&JSON.stringify((previous.snapshot as any).orderIds)!==JSON.stringify(ids))throw Error('STOCK_REQUEST_CHANGED');
  if(reservations.some(r=>r.status==='RECONCILING')&&!previous)throw Error('STOCK_RECONCILIATION_IN_PROGRESS');
  const client=await stockGoogleClient();
  const plan=await applyFlowOperation(client,id,'ALREADY_COUNTED',actor,async()=>{
   const totals=new Map<string,number>();
   for(const r of reservations){
    if(r.status==='ALREADY_COUNTED')continue;
    if(!['QUEUED','RESERVED','RECONCILING'].includes(r.status))throw Error('STOCK_RESERVATION_CHANGED');
    const operation=await db.stockSheetOperation.findUnique({where:{id:'reserve:'+r.orderId}});
    if(operation&&operation.status!=='APPLIED')throw Error('STOCK_RESERVATION_UNCONFIRMED');
    if(!operation){if(r.status==='RESERVED')throw Error('STOCK_RESERVATION_UNCONFIRMED');continue;}
    for(const c of (operation.snapshot as any).changes){
     const amount=milli(c.pendingAfter)-milli(c.pendingBefore??0);
     if(amount<=0)throw Error('STOCK_RESERVATION_UNCONFIRMED');
     totals.set(c.code,(totals.get(c.code)??0)+amount);
    }
   }
   const items:OrderStockItem[]=[...totals].map(([code,quantityMilliG])=>({code,quantityMilliG}));
   const source=await readStockSheet(client);
   for(const r of reservations){const operation=await db.stockSheetOperation.findUnique({where:{id:'reserve:'+r.orderId}});if(operation&&operation.sourceSheet!==source.tab.title)throw Error('STOCK_SOURCE_CHANGED');}
   return {...flowReservationPlan(items,source,true),orderIds:ids,items};
  },async()=>{
   // Persist this guard before touching Sheets, so a lost response cannot let
   // a shipment or cancellation consume the quantities being reconciled.
   await db.stockReservation.updateMany({where:{orderId:{in:ids},status:{not:'ALREADY_COUNTED'}},data:{status:'RECONCILING'}});
  });
  for(const r of reservations){
   await tx.stockReservation.update({where:{orderId:r.orderId},data:{status:'ALREADY_COUNTED',issues:[]}});
   await tx.auditLog.upsert({where:{id:'stock-already-counted:'+r.orderId},create:{id:'stock-already-counted:'+r.orderId,actor,action:'STOCK_ALREADY_COUNTED',entityId:r.orderId,details:{orderNumber:r.orderNumber,items:r.items,reason:'เจ้าของยืนยันว่ารวมในยอดจ่ายเดิมแล้ว ไม่นับรอจ่ายและไม่ตัดซ้ำ'}},update:{}});
  }
  return {orders:ids.length,releasedQuantityG:(plan.items as OrderStockItem[]).reduce((n,i)=>n+i.quantityMilliG/1000,0),replayed:previous?.status==='APPLIED'};
 },{timeout:55000,maxWait:10000});
}

