import {db,transaction,userLock,currentShopSlug} from './db';
import type {Role} from './accounts';
import {accountingReport} from './accounting-report';
import {accountingBasis} from './accounting-summary';
import {bookedSalesReport} from './booked-sales';
import {salesReport} from './sales-report';
import {dayStart,shiftDay,bangkokDay,DAY_MS} from './sales-dates';
import {readStockSheet} from './stock-google';
import {activeCustomerProfileFilter} from './customer-profile-deletion';
import {customerChatInput,chatRange,stockChatInput,matchesStockThreshold,type ChatData} from './admin-chat';

export async function claimAdminChat(actor:string){
 await transaction(async tx=>{
  await userLock(tx,'admin-chat:'+actor);
  const count=await tx.auditLog.count({where:{actor,action:'ADMIN_CHAT_REQUESTED',createdAt:{gte:new Date(Date.now()-60000)}}});
  if(count>=8)throw Error('CHAT_RATE_LIMIT');
  await tx.auditLog.create({data:{actor,action:'ADMIN_CHAT_REQUESTED',entityId:actor,details:{mode:'read-only'}}});
 });
}

export async function readAdminChatData(role:Role,name:string,args:unknown):Promise<ChatData>{
 if(!['owner','admin'].includes(role))throw Error('CHAT_FORBIDDEN');
 const readAt=new Date().toISOString(),slug=currentShopSlug(),base=slug?'/shops/'+encodeURIComponent(slug):'/admin';
 if(name==='customer_lookup'){
  const input=customerChatInput.parse(args);
  const activity=await db.orderIntake.groupBy({by:['customerCode'],where:{customerCode:{not:null},withdrawnAt:null,status:{notIn:['CANCELLED','WITHDRAWN','EXPIRED']},payment:{in:['โอน','COD']}},_max:{eventAt:true}});
  const lastByCode=new Map(activity.flatMap(row=>row.customerCode&&row._max.eventAt?[[row.customerCode,row._max.eventAt] as const]:[]));
  const now=new Date(),today=dayStart(bangkokDay(now));
  const inactiveCodes=[...lastByCode].filter(([,at])=>Math.round((+today-+dayStart(bangkokDay(at)))/DAY_MS)>=input.inactiveDays).map(([code])=>code);
  const where={AND:[activeCustomerProfileFilter,...(input.query?[{OR:[{code:{contains:input.query,mode:'insensitive' as const}},{name:{contains:input.query,mode:'insensitive' as const}}]}]:[]),...(input.activity==='inactive'?[{code:{in:inactiveCodes}}]:input.activity==='never'?[{code:{notIn:[...lastByCode.keys()]}}]:[])]};
  const [total,rows]=await Promise.all([db.customer.count({where}),db.customer.findMany({where,orderBy:{code:'asc'},take:30,select:{code:true,name:true}})]);
  const shown=rows.map(row=>({...row,lastOrderedAt:lastByCode.get(row.code)?.toISOString()??null,daysSinceLastOrder:lastByCode.has(row.code)?Math.round((+today-+dayStart(bangkokDay(lastByCode.get(row.code)!)))/DAY_MS):null}));
  return {source:{title:'รายชื่อลูกค้า',url:slug?base+'/customers':'/admin/crm',readAt},data:{query:input,total,shown,truncated:total>shown.length,basis:'Days since non-cancelled COD or transfer order, including unfulfilled orders. Never ordered is distinct from inactive after a previous order.'},table:{title:'รายชื่อลูกค้าที่พบ',total,columns:['รหัส','ชื่อ','สั่งซื้อล่าสุด','วันที่ไม่ได้สั่งซื้อ'],rows:shown.map(row=>({cells:[row.code,row.name||'ยังไม่ระบุชื่อ',row.lastOrderedAt?bangkokDay(new Date(row.lastOrderedAt)):'ยังไม่เคยสั่งซื้อ',row.daysSinceLastOrder===null?'—':String(row.daysSinceLastOrder)],url:slug?base+'/customers?q='+encodeURIComponent(row.code):'/admin/crm/'+encodeURIComponent(row.code)}))}};
 }
 if(name==='stock_lookup'){
  if(slug&&role!=='owner')throw Error('CHAT_FORBIDDEN');
  const input=stockChatInput.parse(args);
  // Read the same primary stock source as the stock page. Cached data is
  // explicitly identified if that source is temporarily unavailable.
  const live=await readStockSheet().catch(()=>null);
  const cached=live?[]:await db.stockProduct.findMany({orderBy:{code:'asc'}});
  if(!live&&!cached.length)throw Error('STOCK_UNAVAILABLE');
  const products=live?live.products.map(p=>({code:p.code,name:p.name,remainingGrams:p.remainingQuantity,costSatangPerGram:p.costSatang})):cached.map(p=>({code:p.code,name:p.name,remainingGrams:p.remainingQuantity?.toNumber()??null,costSatangPerGram:p.costSatang}));
  const query=input.query.toLocaleLowerCase();
  const matching=products.filter(p=>!query||(p.code+' '+(p.name??'')).toLocaleLowerCase().includes(query));
  const filtered=matching.filter(p=>matchesStockThreshold(p.remainingGrams,input)).sort((a,b)=>(a.remainingGrams??Infinity)-(b.remainingGrams??Infinity)||a.code.localeCompare(b.code));
  const shown=filtered.slice(0,30);
  return {source:{title:'สต๊อกสินค้า',url:base+'/stock'+(input.query?'?q='+encodeURIComponent(input.query):''),readAt},data:{basis:'Physical remaining grams, not sellable quantity. No inventory projection.',cached:!live,sourceReadAt:live?.readAt.toISOString()??null,oldestCachedAt:cached.length?new Date(Math.min(...cached.map(p=>+p.updatedAt))).toISOString():null,filters:input,total:filtered.length,shownCount:shown.length,unknownBalanceCount:matching.filter(p=>p.remainingGrams===null).length,shown,truncated:filtered.length>30},table:{title:'สินค้าตรงเงื่อนไขสต๊อก',total:filtered.length,columns:['รหัสสินค้า','ชื่อ','คงเหลือ (กรัม)'],rows:shown.map(row=>({cells:[row.code,row.name||'ยังไม่ระบุชื่อ',row.remainingGrams===null?'ไม่ทราบ':String(row.remainingGrams)],url:base+'/stock?q='+encodeURIComponent(row.code)}))}};
 }
 const range=chatRange.parse(args),query=new URLSearchParams(range).toString();
 if(name==='sales_summary'&&slug){
  const report=await bookedSalesReport(range);
  return {source:{title:'ยอดขายตามรอบออเดอร์ '+range.from+' ถึง '+range.to,url:base+'/sales?'+query,readAt},data:{range,moneyUnit:'satang',basis:'Booked sales by shop order close rounds, matching this shop sales page. Profit is gross, not net; null profit means incomplete data.',total:report.summary}};
 }
 if(name==='sales_summary'){
  const report=await salesReport(range),s=report.summary;
  return {source:{title:'รายงานยอดขาย '+range.from+' ถึง '+range.to,url:base+'/sales?'+query,readAt},data:{range,moneyUnit:'satang',basis:'Recognized sales by actual dispatch date. COD must be received and matched; not orders placed or cash income.',total:{count:s.count,revenueSatang:s.revenueSatang,transferSatang:s.transferSatang,codSatang:s.codSatang,waitingCost:s.waitingCost},waitingCodCount:report.waitingCodCount,waitingCodSatang:report.waitingCodSatang,previous:report.previous,daily:report.daily.length<=62?report.daily:undefined}};
 }
 if(name==='accounting_summary'){
  const report=await accountingReport({...range,view:'month'});
  return {source:{title:'บัญชีสรุป '+range.from+' ถึง '+range.to,url:base+'/accounting?'+query,readAt},data:{range,moneyUnit:'satang',basis:accountingBasis,total:report.total,monthly:report.rows,notices:report.notices,waitingCodSatang:report.waitingCodSatang}};
 }
 if(name==='order_summary'&&role==='owner'){
  const rows=await db.orderIntake.groupBy({by:['status'],where:{eventAt:{gte:dayStart(range.from),lt:dayStart(shiftDay(range.to,1))}},_count:{_all:true}});
  return {source:{title:'รายการออเดอร์',url:slug?base+'/orders':'/admin/orders/list',readAt},data:{range,basis:'Counts of orders received by eventAt in Bangkok calendar dates; not accounting income or shipping close rounds.',statuses:rows.map(r=>({status:r.status,count:r._count._all})),total:rows.reduce((sum,r)=>sum+r._count._all,0)}};
 }
 throw Error('CHAT_FORBIDDEN');
}
