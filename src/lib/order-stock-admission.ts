import type {Prisma} from '@prisma/client';
import {db,userLock} from './db';
import {readStockSheet} from './stock-google';
import {orderStockItems,type OrderStockItem} from './order-stock-items';
import {stockSellableQuantity,stockSafetyReserveGrams} from './stock-sales-limit';
import {milli} from './stock-flow-plan';
import {reservationOperationId} from './stock-flow';
import type {StockRow} from './stock-import';
import {websiteOrderStockItems} from './website-order-stock';
import {loadStockSaleAvailability,pausedStockReasons} from './stock-sale-availability';
export type StockReader=typeof readStockSheet;
export async function pendingStockSaleItems(tx:Prisma.TransactionClient=db,excludeOrderId?:string){
 const reservations=await tx.stockReservation.findMany({where:{status:'QUEUED',precounted:false,needsReconciliation:false,...(excludeOrderId?{orderId:{not:excludeOrderId}}:{})}});
 const orders=reservations.length?await tx.orderIntake.findMany({where:{id:{in:reservations.map(r=>r.orderId)},status:{notIn:['CANCELLED','WITHDRAWN','EXPIRED','RETURNED']}},select:{id:true}}):[];
 const active=new Set(orders.map(o=>o.id));const ids=reservations.map(reservationOperationId);
 const operations=ids.length?await tx.stockSheetOperation.findMany({where:{id:{in:ids},status:'APPLIED'},select:{id:true}}):[];
 const applied=new Set(operations.map(o=>o.id));
 const queued=reservations.filter(r=>active.has(r.orderId)&&!applied.has(reservationOperationId(r))).flatMap(r=>{
  const items=r.items as unknown as OrderStockItem[],previous=r.adjustmentFrom as {items:OrderStockItem[]}|null;
  return previous?items.map(item=>({...item,quantityMilliG:Math.max(0,item.quantityMilliG-previous.items.filter(old=>old.code===item.code).reduce((total,old)=>total+old.quantityMilliG,0))})).filter(item=>item.quantityMilliG>0):items;
 });
 // Website orders hold stock while they wait for owner review; approval moves the hold to a reservation.
 const websiteOrders=await tx.websiteOrder.findMany({where:{status:'PENDING_REVIEW'},select:{items:true}});
 return [...queued,...websiteOrders.flatMap(order=>websiteOrderStockItems(order.items))];
}
export function unavailableStock(items:OrderStockItem[],products:StockRow[],pending:OrderStockItem[]=[]){
 const reasons:string[]=[];
 for(const item of items){
  const product=products.find(p=>p.code===item.code);
  if(!product){reasons.push('ไม่พบสินค้า '+item.code+' ในสต๊อก');continue;}
  const queued=pending.filter(p=>p.code===item.code).reduce((sum,p)=>sum+p.quantityMilliG,0);
  const available=stockSellableQuantity(product,queued);
  if(available===null){reasons.push('ยังตรวจสอบจำนวนสินค้า '+item.code+' ไม่ได้');continue;}
  const remaining=milli(available);
  const quantity=(n:number)=>(n/1000).toLocaleString('th-TH',{maximumFractionDigits:3});
  if(remaining<=0)reasons.push('สินค้า '+item.code+' หมดสำหรับขาย · จำนวนที่จำหน่ายได้ 0 กรัม · สำรอง '+stockSafetyReserveGrams+' กรัม');
  else if(remaining<item.quantityMilliG)reasons.push('สินค้า '+item.code+' ไม่พอ · จำนวนที่จำหน่ายได้ '+quantity(remaining)+' กรัม · สั่ง '+quantity(item.quantityMilliG)+' กรัม (หักสำรอง '+stockSafetyReserveGrams+' กรัมแล้ว)');
 }
 return reasons;
}
// The shared stock lock prevents admission from racing sheet reservation/dispatch.
// QUEUED reservations are deducted until their sheet operation is confirmed.
export async function checkOrderStock(tx:Prisma.TransactionClient,text:string,read:StockReader=readStockSheet){
 await userLock(tx,'stock-sheet-add');
 const parsed=orderStockItems(text);
 const availability=await loadStockSaleAvailability(tx);
 // Even an unparseable form must not bypass a specifically paused product code.
 const codes=parsed.issues.length?(text.normalize('NFKC').toUpperCase().match(/[\p{L}\p{M}\p{N}._-]+/gu)??[]):parsed.items.map(item=>item.code);
 const paused=pausedStockReasons(codes,availability);
 if(paused.length)return {items:parsed.items,reasons:paused};
 const config=await tx.stockWorkflow.findUnique({where:{id:'active'}});if(!config?.enabled)return null;
 if(parsed.issues.length)return {items:parsed.items,reasons:['ตรวจสอบสต๊อกไม่ได้ กรุณาระบุสินค้าเป็นรหัสและจำนวน เช่น CG13 x 20 G']};
 try{
  const source=await read();if(source.tab.title!==config.sourceSheet)return {items:parsed.items,reasons:['สต๊อกอยู่ระหว่างเปลี่ยนรอบ กรุณาติดต่อผู้ดูแลแล้วส่งใหม่']};
  const pending=await pendingStockSaleItems(tx);
  return {items:parsed.items,reasons:unavailableStock(parsed.items,source.products,pending)};
 }catch{return {items:parsed.items,reasons:['ตรวจสอบสต๊อกล่าสุดไม่ได้ กรุณาลองส่งใหม่ภายหลัง']};}
}
