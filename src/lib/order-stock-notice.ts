import {z} from 'zod';
import {db} from './db';
import {queueStockOrder,reservationOperationId,syncStockReservationLocked} from './stock-flow';
import {milli,type FlowPlan} from './stock-flow-plan';
import type {OrderStockItem} from './order-stock-items';

const noticeSchema=z.object({version:z.literal(1),checkedAt:z.string(),items:z.array(z.object({code:z.string(),quantityMilliG:z.number().int().positive(),before:z.number().int().nullable(),after:z.number().int().nullable()})).max(50)});
export type OrderStockNotice=z.infer<typeof noticeSchema>;
export function noticeFromReservation(items:OrderStockItem[],plan:FlowPlan,checkedAt:Date):OrderStockNotice{
 return {version:1,checkedAt:checkedAt.toISOString(),items:items.map(item=>{
  const matches=plan.changes.filter(c=>c.code===item.code),c=matches.length===1?matches[0]:undefined;
  if(!c||c.remainingBefore===null||c.remainingAfter===null||c.pendingBefore===null||(c.unverifiedBefore??0)>0||(c.unverifiedAfter??0)>0)return {...item,before:null,after:null};
  const before=milli(c.remainingBefore)-milli(c.pendingBefore)+milli(c.precountedBefore??0),after=milli(c.remainingAfter)-milli(c.pendingAfter)+milli(c.precountedAfter??0);
  if(before-after!==item.quantityMilliG)throw Error('STOCK_NOTICE_RESERVATION_MISMATCH');
  return {...item,before,after};
 })};
}
const unavailable='ยังตรวจสอบจำนวนสินค้าไม่ได้ กรุณาตรวจสต๊อกในระบบ';
export async function getOrderStockNotice(orderId:string):Promise<OrderStockNotice|string|null>{
 try{
  const config=await db.stockWorkflow.findUnique({where:{id:'active'}});if(!config?.enabled)return null;
  return await db.$transaction(async tx=>{
   const locks=await tx.$queryRawUnsafe<{locked:boolean}[]>('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked','stock-sheet-add');
   if(!locks[0]?.locked)return unavailable;
   const order=await db.orderIntake.findUnique({where:{id:orderId}});
   if(!order||['RETURNED','WITHDRAWN','EXPIRED','CANCELLED'].includes(order.status))return null;
   const saved=await db.auditLog.findUnique({where:{id:'stock-order-availability:'+orderId},select:{details:true}});
   const parsed=noticeSchema.safeParse(saved?.details);if(parsed.success)return parsed.data;
   const [dispatch,returned,operation]=await Promise.all([db.stockDispatch.findUnique({where:{orderId}}),db.stockReturn.findFirst({where:{orderId},select:{id:true}}),db.stockSheetOperation.findUnique({where:{id:'dispatch:'+orderId}})]);
   if(dispatch||returned||operation)return null;
   const queued=await queueStockOrder(orderId);if(!queued)return unavailable;
   if(queued.precounted||queued.needsReconciliation||['CONSUMED','RELEASED','ALREADY_COUNTED','RECONCILING'].includes(queued.status))return unavailable;
   if(queued.status!=='RESERVED'){const result=await syncStockReservationLocked(orderId);if(result.status!=='RESERVED')return unavailable;}
   const reservation=await db.stockReservation.findUniqueOrThrow({where:{orderId}});
   const applied=await db.stockSheetOperation.findUnique({where:{id:reservationOperationId(reservation)}});
   if(reservation.status!=='RESERVED'||!applied||applied.status!=='APPLIED'||applied.sourceSheet!==config.sourceSheet)return unavailable;
   const items=reservation.items as unknown as OrderStockItem[],plan=applied.snapshot as unknown as FlowPlan;
   if(!items.length||items.length>50||!Array.isArray(plan.changes))return unavailable;
   const notice=noticeFromReservation(items,plan,applied.appliedAt??new Date());
   if(notice.items.some(i=>i.before===null))return notice;
   await tx.auditLog.upsert({where:{id:'stock-order-availability:'+orderId},create:{id:'stock-order-availability:'+orderId,actor:'line-order',action:'STOCK_ORDER_AVAILABILITY_CHECKED',entityId:orderId,details:notice},update:{}});
   return notice;
  },{timeout:45000,maxWait:1000});
 }catch{return unavailable;}
}
export function stockNoticeText(notice:OrderStockNotice|string|null){
 if(!notice)return '';
 if(typeof notice==='string')return notice;
 const quantity=(n:number)=>(n/1000).toLocaleString('th-TH',{maximumFractionDigits:3});
 const lines=notice.items.flatMap(i=>{
  if(i.before===null||i.after===null)return [i.code+': ยังไม่ทราบจำนวนสินค้า กรุณาตรวจสอบ'];
  if(i.after>0)return [];
  if(i.after===0)return [i.code+': หลังออเดอร์นี้สินค้าหมด (รายการนี้มีสินค้าครบ)'];
  const shortage=i.quantityMilliG-Math.max(0,i.before);
  return [i.code+(i.before<=0?': สินค้าหมด':': สินค้าเหลือเพียง '+quantity(i.before)+' กรัม ไม่พอขาย')+' · สั่ง '+quantity(i.quantityMilliG)+' กรัม · ขาด '+quantity(shortage)+' กรัม'];
 });
 return lines.length?'แจ้งเตือนสต๊อก ณ เวลารับออเดอร์\n'+lines.join('\n'):'';
}
export function confirmationMessages(confirmation:string,notice:OrderStockNotice|string|null){
 const text=stockNoticeText(notice),combined=text?text+'\n\n'+confirmation:confirmation;
 const messages:string[]=[];let part='';
 for(const line of combined.split('\n')){
  if(part.length+line.length+1>4500){messages.push(part);part='';}
  part+=(part?'\n':'')+line;
 }
 if(part)messages.push(part);
 if(messages.length>5||messages.some(m=>m.length>5000))throw Error('ORDER_REPLY_TOO_LONG');
 return messages.map(text=>({type:'text' as const,text}));
}
