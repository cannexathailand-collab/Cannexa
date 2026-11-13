import {exploreChatData,explorerTools} from './admin-chat-explorer';
import {loadCustomerLineStatuses} from './customer-line-message';
import {z} from 'zod';
import {pendingStockSaleItems} from './order-stock-admission';
import {stockSellableQuantity} from './stock-sales-limit';
import {rankChatProductSales} from './admin-chat-product-sales';
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
 if(explorerTools.some(tool=>tool.name===name))return exploreChatData(role,name,args);
 if(name==='customer_line_status'){
  if(role!=='owner')throw Error('CHAT_FORBIDDEN');
  const input=z.object({query:z.string().trim().max(100),filter:z.enum(['all','linked','unlinked','ready','not_ready'])}).strict().parse(args);
  const customers=await db.customer.findMany({where:{AND:[activeCustomerProfileFilter,...(input.query?[{OR:[{code:{contains:input.query,mode:'insensitive' as const}},{name:{contains:input.query,mode:'insensitive' as const}}]}]:[])]},select:{code:true,name:true,lineUserKey:true},orderBy:{code:'asc'},take:5001});
  if(customers.length>5000)throw Error('REFINE_CUSTOMER_SEARCH');
  const statuses=await loadCustomerLineStatuses(customers);
  const evidence=await db.lineMessageRecipient.findMany({where:{lineUserKey:{in:customers.flatMap(row=>row.lineUserKey?[row.lineUserKey]:[])}},select:{lineUserKey:true,displayName:true,lastMessageAt:true,encryptedUserId:true}});
  const byKey=new Map(evidence.map(row=>[row.lineUserKey,row]));
  const rows=customers.map(row=>{const saved=row.lineUserKey?byKey.get(row.lineUserKey):undefined;return {code:row.code,name:row.name,linked:!!row.lineUserKey,hasLineUserId:!!saved?.encryptedUserId,lineDisplayName:saved?.displayName??null,lastIncomingMessageAt:saved?.lastMessageAt?.toISOString()??null,messageBodyStored:false,...statuses.get(row.code)};}).filter(row=>input.filter==='all'||input.filter==='linked'&&row.linked||input.filter==='unlinked'&&!row.linked||input.filter==='ready'&&row.ready||input.filter==='not_ready'&&!row.ready);
  const shown=rows.slice(0,30);
  return {source:{title:'สถานะ LINE ของลูกค้า',url:slug?base+'/customers':'/admin/crm',readAt},data:{filter:input,total:rows.length,shownCount:shown.length,shown,truncated:rows.length>30,basis:'Binding is not complete conversation history. messageBodyStored false means message text is not stored; lastIncomingMessageAt is an event timestamp only. hasLineUserId refers to the Messaging API userId, not the public LINE ID. Binding and message readiness are separate. Readiness follows current shop LINE configuration and latest stored friendship/message state, not a live guarantee of delivery.'},table:{title:'สถานะ LINE ลูกค้า',columns:['รหัส','ชื่อ','ผูกบัญชี LINE','ชื่อ LINE','เคยส่งข้อความ','สถานะรับข้อความ'],total:rows.length,rows:shown.map(row=>({cells:[row.code,row.name??'—',row.linked?'ผูกแล้ว':'ยังไม่ผูก',row.lineDisplayName??'ยังไม่มีชื่อ',row.lastIncomingMessageAt?'พบเวลาส่งล่าสุด':'ยังไม่มีเหตุการณ์',row.label??'ไม่ทราบ'],url:slug?base+'/customers?q='+encodeURIComponent(row.code):'/admin/crm/'+encodeURIComponent(row.code)}))}};
 }
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
  if(!live&&input.quantityBasis==='sellable')throw Error('STOCK_LIVE_REQUIRED');
  const pending=input.quantityBasis==='sellable'?await pendingStockSaleItems():[];
  const products=live?live.products.map(p=>({code:p.code,name:p.name,remainingGrams:p.remainingQuantity,sellableGrams:stockSellableQuantity(p,pending.filter(item=>item.code===p.code).reduce((sum,item)=>sum+item.quantityMilliG,0)),costSatangPerGram:p.costSatang})):cached.map(p=>({code:p.code,name:p.name,remainingGrams:p.remainingQuantity?.toNumber()??null,sellableGrams:null,costSatangPerGram:p.costSatang}));
  const quantity=(p:typeof products[number])=>input.quantityBasis==='sellable'?p.sellableGrams:p.remainingGrams;
  const query=input.query.toLocaleLowerCase();
  const matching=products.filter(p=>!query||(p.code+' '+(p.name??'')).toLocaleLowerCase().includes(query));
  const filtered=matching.filter(p=>matchesStockThreshold(quantity(p),input)).sort((a,b)=>(quantity(a)??Infinity)-(quantity(b)??Infinity)||a.code.localeCompare(b.code));
  const shown=filtered.slice(0,30);
  return {source:{title:'สต๊อกสินค้า',url:base+'/stock'+(input.query?'?q='+encodeURIComponent(input.query):''),readAt},data:{basis:input.quantityBasis==='sellable'?'Sellable grams using the same stock page calculation after pending holds and safety reserve. Physical balance is separate.':'Physical remaining grams, not sellable quantity.',cached:!live,sourceReadAt:live?.readAt.toISOString()??null,oldestCachedAt:cached.length?new Date(Math.min(...cached.map(p=>+p.updatedAt))).toISOString():null,filters:input,total:filtered.length,shownCount:shown.length,unknownBalanceCount:matching.filter(p=>quantity(p)===null).length,shown,truncated:filtered.length>30},table:{title:'สินค้าตรงเงื่อนไขสต๊อก',total:filtered.length,columns:['รหัสสินค้า','ชื่อ',input.quantityBasis==='sellable'?'ขายได้ (กรัม)':'คงเหลือจริง (กรัม)'],rows:shown.map(row=>({cells:[row.code,row.name||'ยังไม่ระบุชื่อ',quantity(row)===null?'รอข้อมูล':String(quantity(row))],url:base+'/stock?q='+encodeURIComponent(row.code)}))}};
 }
 const range=chatRange.parse(name==='product_sales_ranking'?{from:(args as any)?.from,to:(args as any)?.to}:args),query=new URLSearchParams(range).toString();
 if(name==='product_sales_ranking'){
  const metric=z.object({from:z.string(),to:z.string(),metric:z.enum(['orders','grams'])}).strict().parse(args).metric;
  const report=await salesReport(range),ids=report.summary.rows.map(row=>row.orderId);
  const orders=await db.orderIntake.findMany({where:{id:{in:ids}},select:{id:true,rawText:true}});
  const ranking=rankChatProductSales(orders,metric),shown=ranking.rows.slice(0,20);
  const names=await db.stockProduct.findMany({where:{code:{in:shown.map(row=>row.code)}},select:{code:true,name:true}}),byCode=new Map(names.map(row=>[row.code,row.name]));
  const rows=shown.map(row=>({...row,name:byCode.get(row.code)??null}));
  return {source:{title:'สินค้าขายดีจากยอดขายที่ยืนยันแล้ว',url:slug?base+'/orders':'/admin/sales?'+query,readAt},data:{range,metric,basis:'Recognized sales by actual shipment date, excluding cancelled, returned and unpaid COD. Rank by orders or grams, never by estimated product revenue.',recognizedOrders:ids.length,unreadableOrders:ranking.unreadableOrders,totalProducts:ranking.rows.length,shown:rows,truncated:ranking.rows.length>20},table:{title:'อันดับสินค้าขายดี · '+(metric==='orders'?'จำนวนออเดอร์':'กรัมที่ขาย'),columns:['อันดับ','รหัสสินค้า','ชื่อ','ออเดอร์','กรัมที่ขาย'],total:ranking.rows.length,rows:rows.map((row,index)=>({cells:[String(index+1),row.code,row.name??'—',String(row.orders),String(row.grams)]}))}};
 }
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
