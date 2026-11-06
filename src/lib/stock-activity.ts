import type {AuditLog} from '@prisma/client';
import {presentAudit} from './audit-report';
import {db} from './db';
import {bangkokDay,dayStart,shiftDay} from './sales-dates';
import {stockHistoryDate} from './stock-history-plan';

const quantity=(v:unknown)=>typeof v==='number'?v.toLocaleString('th-TH')+' G':'ยังไม่ระบุ';
const cost=(v:unknown)=>typeof v==='number'?(v/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท/G':'ยังไม่ระบุ';
export function presentStockActivity(log:AuditLog){
 const event=presentAudit(log),d=(log.details??{}) as Record<string,any>;
 if(log.action==='STOCK_DISPATCH_COST_RECORDED'&&typeof d.dispatchedAt==='string'){
  const dispatchedAt=new Date(d.dispatchedAt);
  if(Number.isFinite(+dispatchedAt))event.summary.push('จัดส่งจริง: '+dispatchedAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}));
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
 return event;
}
export async function stockActivityReport(input:{day?:string;page?:string},now=new Date()){
 const day=stockHistoryDate(input.day,bangkokDay(now));
 const where={action:{startsWith:'STOCK_'},createdAt:{gte:dayStart(day),lt:dayStart(shiftDay(day,1))}};
 const total=await db.auditLog.count({where}),pages=Math.max(1,Math.ceil(total/50));
 const requested=Number(input.page),page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,pages):1;
 const logs=await db.auditLog.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*50,take:50});
 return {day,page,pages,total,events:logs.map(presentStockActivity)};
}
