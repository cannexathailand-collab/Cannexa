import {loadDuplicateOrderReviews} from './order-duplicates';
import type {OrderIntake,Shipment,SalesOrder,Prisma} from '@prisma/client';
import {db} from './db';
import {dayStart,shiftDay} from './sales-dates';
import {csvCell} from './policy';
import {quotedTotal} from './shipment-matching';
import {canonicalCustomerCode} from './customer-code';
import {needsTrackingReview,needsCodReceiptReview} from './order-tracking-review';
import {loadOrderRoundSettings} from './order-round-settings';
import {hasActualDispatch} from './sales-recognition';
import {readStockSheet} from './stock-google';
import {orderProductCost} from './order-product-cost';
import {orderRoundBounds,orderRoundClosingDay} from './order-round';
export const orderStates={ALL:'ทั้งหมด',REVIEW:'ต้องตรวจสอบ',WAITING:'รอจัดส่ง',COD:'รอรับเงิน COD',SHIPPED:'จัดส่งแล้ว',VERIFY:'รอยืนยันการจัดส่ง',CONFIRMED:'ยืนยันการจัดส่งแล้ว',RETURNED:'ตีกลับ',CANCELLED:'ยกเลิก / ปิดรายการ'} as const;
export type OrderFilters={q?:string;from?:string;to?:string;payment?:string;status?:string;sort?:string;page?:string;team?:string;focus?:string};
export function orderMatchesState(row:{state:string;shipped:boolean;awaitingShipment:boolean;awaitingConfirmation?:boolean;shipmentVerified?:boolean},state:string){
 return state==='ALL'?row.state!=='CANCELLED':(state==='CONFIRMED'?!!row.shipmentVerified:state==='VERIFY'?!!row.awaitingConfirmation:state==='SHIPPED'?row.shipped:state==='WAITING'?row.awaitingShipment:row.state===state);
}
export function orderState(order:Pick<OrderIntake,'status'|'payment'|'issues'>&{createdAt?:Date},shipment?:Pick<Shipment,'fulfillmentStatus'|'dispatchedAt'>&{tracking?:string;codSatang?:number},sale?:Pick<SalesOrder,'status'>,now=new Date(),receipt?:{tracking:string;amountSatang:number}):Exclude<keyof typeof orderStates,'ALL'>{
 if(order.status==='RETURNED'||shipment?.fulfillmentStatus==='RETURNED')return 'RETURNED';
 if(['CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status)||shipment?.fulfillmentStatus==='CANCELLED')return 'CANCELLED';
 if(needsTrackingReview(order,shipment?.tracking,now)||needsCodReceiptReview(order,shipment,receipt,now)||order.status==='NEEDS_REVIEW'||order.status==='COD_AMOUNT_MISMATCH'||sale?.status==='WAITING_COST'||Array.isArray(order.issues)&&order.issues.length>0)return 'REVIEW';
 if(order.payment==='COD'&&(sale?.status==='WAITING_COD'||order.status==='MATCHED_SHIPMENT_WAITING_COD'))return 'COD';
 return shipment?.fulfillmentStatus==='DISPATCHED'&&shipment.dispatchedAt?'SHIPPED':'WAITING';
}
export function orderRoundRange(input:{from?:string;to?:string;page?:string}={},now=new Date(),closeMinutes=720){
 const current=shiftDay(orderRoundClosingDay(now,closeMinutes),-1);
 const offset=Math.max(0,Math.min(99999,(Math.trunc(Number(input.page))||1)-1));
 const from=shiftDay(current,-offset),to=from;
 if(from>to)throw Error('INVALID_DATE_RANGE');
 return {from,to,...orderRoundBounds(shiftDay(to,1),closeMinutes)};
}
export async function orderManagement(input:OrderFilters={}){
 const roundSettings=await loadOrderRoundSettings();
 const duplicateReviews=await loadDuplicateOrderReviews();
 const groups=await db.orderGroup.findMany({where:{purpose:'ORDER'},select:{id:true,name:true},orderBy:{name:'asc'}});
 const teams=[...groups.map(group=>({id:group.id,name:group.name||'กลุ่มยังไม่ตั้งชื่อ'})),{id:'website',name:'เว็บไซต์'}];
 const team=teams.some(option=>option.id===input.team)?input.team!:'';
 const teamNames=new Map(teams.map(option=>[option.id,option.name]));
 const q=(input.q??'').trim().slice(0,100),from=input.from??'',to=input.to??'',status=Object.hasOwn(orderStates,input.status??'')?input.status as keyof typeof orderStates:'ALL',payment=['โอน','COD','เคลม'].includes(input.payment??'')?input.payment!:'',sort=input.sort==='oldest'?'oldest':'newest',requestedPage=Math.max(1,Math.min(100000,Math.trunc(Number(input.page))||1));
 if(from)dayStart(from);if(to)dayStart(to);if(from&&to&&from>to)throw Error('INVALID_DATE_RANGE');
 const trackingIds=q?(await db.shipment.findMany({where:{tracking:{contains:q,mode:'insensitive'}},select:{orderId:true}})).flatMap(s=>s.orderId?[s.orderId]:[]):[];
 const where:Prisma.OrderIntakeWhereInput={...(payment?{payment}:{}),...((from||to)?{eventAt:{...(from?{gte:dayStart(from)}:{}),...(to?{lt:dayStart(shiftDay(to,1))}:{})}}:{}),...(q?{OR:[...['orderNumber','recipient','phone','sellerCode','sellerUsername','customerCode'].map(field=>({[field]:{contains:q,mode:'insensitive'}})),{customerCode:{contains:canonicalCustomerCode(q),mode:'insensitive'}},{id:{in:trackingIds}}]}:{})};
 const earliest=await db.orderIntake.findFirst({orderBy:{eventAt:'asc'},select:{eventAt:true}});
 const at=new Date(),latestRound=orderRoundRange({},at,roundSettings.closeMinutes);
 const firstRound=earliest?orderRoundRange({},earliest.eventAt,roundSettings.closeMinutes):latestRound;
 const roundPages=Math.max(1,Math.round((+latestRound.start-+firstRound.start)/86400000)+1);
 const focus=input.focus?await db.orderIntake.findUnique({where:{id:input.focus},select:{orderNumber:true,eventAt:true}}):null;
 const focusRound=focus&&focus.orderNumber===q?orderRoundRange({},focus.eventAt,roundSettings.closeMinutes):null;
 const page=focusRound?Math.max(1,Math.round((+latestRound.start-+focusRound.start)/86400000)+1):requestedPage;
 const roundPage=Math.min(page,roundPages);
 const round=orderRoundRange({page:String(roundPage)},at,roundSettings.closeMinutes);
 where.eventAt={gte:round.start,lt:round.end};
 if(team)where.groupKey=team;
 const orders=await db.orderIntake.findMany({where,orderBy:[{eventAt:sort==='oldest'?'asc':'desc'},{id:'asc'}]});
 const ids=orders.map(o=>o.id),[shipments,sales]=await Promise.all([db.shipment.findMany({where:{orderId:{in:ids}}}),db.salesOrder.findMany({where:{orderId:{in:ids}}})]);
 const shipping=new Map(shipments.map(s=>[s.orderId,s])),saleMap=new Map(sales.map(s=>[s.orderId,s]));
 const [receipts,reports]=await Promise.all([db.codReceipt.findMany({where:{tracking:{in:shipments.map(s=>s.tracking)}}}),db.gmailImport.findMany({where:{id:{in:shipments.map(s=>s.importId)},kind:'SHIPMENT'},select:{id:true}})]),verifiedReports=new Set(reports.map(report=>report.id)),receiptMap=new Map(receipts.map(r=>[r.tracking,r])),now=new Date();
 const stockReviews=await db.stockDispatch.findMany({where:{orderId:{in:ids},status:{in:['NEEDS_REVIEW','WAITING_COST','HISTORY_SAVED']}},select:{orderId:true,issues:true,status:true}});
 const stockReviewMap=new Map(stockReviews.map(review=>[review.orderId,review]));
 const all=orders.map(order=>{const shipment=shipping.get(order.id),sale=saleMap.get(order.id),receipt=shipment?receiptMap.get(shipment.tracking):undefined,closed=['CANCELLED','WITHDRAWN','EXPIRED','RETURNED'].includes(order.status),shipped=!closed&&!!shipment&&hasActualDispatch(shipment);const stockReview=!closed&&shipment?.tracking?stockReviewMap.get(order.id):undefined;const duplicateMatches=duplicateReviews.get(order.id)??[];return {order,stockReview,duplicateMatches,teamName:teamNames.get(order.groupKey)??'ยังไม่ระบุทีม',shipment,sale,receipt,shipped,shipmentVerified:shipped&&!!shipment&&verifiedReports.has(shipment.importId),awaitingConfirmation:shipped&&!!shipment&&!verifiedReports.has(shipment.importId),awaitingShipment:!closed&&!shipped,state:stockReview||duplicateMatches.length?'REVIEW' as const:orderState(order,shipment,sale,now,receipt),amountSatang:quotedTotal(order.rawText??'')??sale?.revenueSatang??null};});
 const counts=Object.fromEntries(Object.keys(orderStates).map(key=>[key,all.filter(row=>orderMatchesState(row,key)).length])) as Record<keyof typeof orderStates,number>;
 const filtered=all.filter(row=>orderMatchesState(row,status));
 const active=all.filter(row=>row.state!=='CANCELLED');
 const totalAmountSatang=active.reduce((total,row)=>total+(row.amountSatang??0),0);
 const transferAmountSatang=active.filter(row=>row.order.payment==='โอน').reduce((total,row)=>total+(row.amountSatang??0),0);
 const codAmountSatang=active.filter(row=>row.order.payment==='COD').reduce((total,row)=>total+(row.amountSatang??0),0);
 const unknownAmountCount=active.filter(row=>row.amountSatang===null).length;
 const dispatches=await db.stockDispatch.findMany({where:{orderId:{in:active.map(row=>row.order.id)},status:'POSTED'},select:{orderId:true,totalCostSatang:true}});
 const recordedCosts=new Map(dispatches.map(row=>[row.orderId,row.totalCostSatang]));
 const needsEstimate=active.some(row=>recordedCosts.get(row.order.id)==null);
 const stock=needsEstimate?await readStockSheet().catch(()=>null):null;
 const unitCosts=new Map(stock?.products.map(product=>[product.code,product.costSatang]));
 const costs=active.map(row=>orderProductCost(row.order.rawText,recordedCosts.get(row.order.id)??null,unitCosts));
 const unknownCostCount=costs.filter(cost=>cost.amountSatang===null).length;
 const productCostSatang=unknownCostCount?null:costs.reduce((total,cost)=>total+(cost.amountSatang??0),0);
 const afterProductCostSatang=unknownAmountCount||productCostSatang===null?null:totalAmountSatang-productCostSatang;
 return {filters:{q,from:'',to:'',status,payment,sort,team,page:String(roundPage)},teams,round,roundSettings,counts,totalAmountSatang,transferAmountSatang,codAmountSatang,unknownAmountCount,productCostSatang,afterProductCostSatang,unknownCostCount,estimatedCosts:costs.some(cost=>cost.estimated),all:filtered,rows:filtered,count:filtered.length,page:roundPage,pages:roundPages};
}
export function orderListCsv(data:Awaited<ReturnType<typeof orderManagement>>){
 const rows=[['เลขออเดอร์','วันที่รับ','ทีม / บ้าน','ลูกค้า','เบอร์โทร','ผู้ขาย','การชำระ','ยอดตามออเดอร์ (บาท)','สถานะ','เลขพัสดุ'],...data.all.map(({order:o,teamName,shipment:s,state,amountSatang,shipped})=>[o.orderNumber,o.eventAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}),teamName??'ยังไม่ระบุทีม',o.recipient??'',o.phone??'',o.sellerUsername??o.sellerCode??'',o.payment??'',amountSatang===null?'':(amountSatang/100).toFixed(2),(shipped&&state!=='SHIPPED'?'จัดส่งแล้ว · ':'')+orderStates[state],s?.tracking??''])];
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
