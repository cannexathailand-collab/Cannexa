import type {AuditLog} from '@prisma/client';
import {presentAudit} from './audit-report';
import {db} from './db';
import {bangkokDay,dayStart,shiftDay} from './sales-dates';
import {stockHistoryDate} from './stock-history-plan';

const quantity=(v:unknown)=>typeof v==='number'?v.toLocaleString('th-TH')+' G':'ยังไม่ระบุ';
const cost=(v:unknown)=>typeof v==='number'?(v/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท/G':'ยังไม่ระบุ';
export const stockActivityActions={STOCK_PRODUCT_UPDATED:'แก้ไขข้อมูลสินค้า',STOCK_RECEIVED:'รับสินค้าเพิ่ม',STOCK_PRODUCT_ADDED:'เพิ่มสินค้าใหม่',STOCK_PRODUCT_DELETED:'ลบสินค้า',STOCK_PRODUCT_IMAGE_UPDATED:'แก้ไขรูปสินค้า',STOCK_COST_UPDATED:'แก้ไขต้นทุน',STOCK_RETURN_RECEIVED_CONFIRMED:'ยืนยันรับสินค้าตีกลับ'};
export function presentStockActivity(log:AuditLog){
 const event=presentAudit(log),d=(log.details??{}) as Record<string,any>;
 if(log.action==='STOCK_RETURN_POSTED'&&Array.isArray(d.items))for(const item of d.items){
  event.summary.push(item.code+' · รับคืน '+quantity(item.quantityMilliG/1000)+' · คงเหลือ '+quantity(item.remainingBefore)+' → '+quantity(item.remainingAfter));
 }
 if(log.action==='STOCK_RETURN_EMAIL_REVIEW'&&Array.isArray(d.issues))event.summary.push(...d.issues.filter((issue:unknown)=>typeof issue==='string'));
 if(log.action==='STOCK_DISPATCH_COST_RECORDED'&&typeof d.dispatchedAt==='string'){
  const dispatchedAt=new Date(d.dispatchedAt);
  if(Number.isFinite(+dispatchedAt))event.summary.push('จัดส่งจริง: '+dispatchedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}));
  if(Array.isArray(d.items))for(const item of d.items)if(typeof item.receivedBefore==='number'&&typeof item.receivedAfter==='number')event.summary.push(item.code+' · ยอดตั้งต้นก่อนตัด: '+quantity(item.receivedBefore)+' → ยอดยกมารอบใหม่: '+quantity(item.receivedAfter));
 }
 if(['STOCK_RECEIVED','STOCK_PRODUCT_ADDED'].includes(log.action)){
  event.summary.push('จำนวนรับ: '+quantity(d.receivedBefore)+' → '+quantity(d.receivedAfter),'คงเหลือ: '+quantity(d.remainingBefore)+' → '+quantity(d.remainingAfter));
  if('nameAfter'in d&&d.nameBefore!==d.nameAfter)event.summary.push('ชื่อ: '+(d.nameBefore??'ยังไม่มีชื่อ')+' → '+(d.nameAfter??'ยังไม่มีชื่อ'));
  if('costAfter'in d&&d.costBefore!==d.costAfter)event.summary.push('ต้นทุน: '+cost(d.costBefore)+' → '+cost(d.costAfter));
 }
 if(log.action==='STOCK_PRODUCT_DELETED'&&d.snapshot){
  if(!d.name&&d.snapshot.name)event.summary.push('ชื่อ: '+d.snapshot.name);
  event.summary.push('ต้นทุนก่อนลบ: '+cost(d.snapshot.costSatang));
 }
 if(log.action==='STOCK_PRODUCT_UPDATED'&&d.before&&d.after&&'receivedQuantity'in d.after){
  event.summary.push('จำนวนรับ: '+quantity(d.before.receivedQuantity)+' → '+quantity(d.after.receivedQuantity),'คงเหลือ: '+quantity(d.before.remainingQuantity)+' → '+quantity(d.after.remainingQuantity));
 }
 if(['STOCK_RESERVED','STOCK_RESERVATION_RELEASED','STOCK_ALREADY_COUNTED','STOCK_PENDING_RESTORED'].includes(log.action)){event.summary.push('ออเดอร์: '+d.orderNumber);if(Array.isArray(d.items))for(const i of d.items)event.summary.push(i.code+' · '+quantity(i.quantityMilliG/1000));}
 return event;
}
export async function stockActivityReport(input:{day?:string;from?:string;to?:string;actor?:string;action?:string;page?:string},now=new Date()){
 const day=stockHistoryDate(input.day,bangkokDay(now));
 const from=input.from||day,to=input.to||input.from||day;
 const staff=await db.userAccount.findMany({where:{role:'store'},select:{username:true},orderBy:{username:'asc'}});
 const actor=input.actor?.trim().slice(0,100)||'',action=input.action&&Object.hasOwn(stockActivityActions,input.action)?input.action:'';
 let error='';try{dayStart(from);dayStart(to);if(from>to)throw Error();}catch{error='กรุณาเลือกช่วงวันที่ให้ถูกต้อง โดยวันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด';}
 if(error)return {day,from,to,actor,action,staff,error,page:1,pages:1,total:0,events:[]};
 const where={action:action?{equals:action}:{startsWith:'STOCK_'},actor:{in:staff.filter(account=>!actor||account.username===actor).map(account=>account.username)},createdAt:{gte:dayStart(from),lt:dayStart(shiftDay(to,1))}};
 const total=await db.auditLog.count({where}),pages=Math.max(1,Math.ceil(total/50));
 const requested=Number(input.page),page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,pages):1;
 const logs=await db.auditLog.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*50,take:50});
 return {day,from,to,actor,action,staff,error,page,pages,total,events:logs.map(presentStockActivity)};
}
