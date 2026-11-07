import type {OrderIntake,Shipment,SalesOrder,Prisma} from '@prisma/client';
import {db} from './db';
import {dayStart,shiftDay} from './sales-dates';
import {csvCell} from './policy';
import {quotedTotal} from './shipment-matching';
import {canonicalCustomerCode} from './customer-code';
import {needsTrackingReview,needsCodReceiptReview} from './order-tracking-review';
export const orderStates={ALL:'ทั้งหมด',REVIEW:'ต้องตรวจสอบ',WAITING:'รอจัดส่ง',COD:'รอรับเงิน COD',SHIPPED:'จัดส่งแล้ว',RETURNED:'ตีกลับ',CANCELLED:'ยกเลิก / ปิดรายการ'} as const;
export type OrderFilters={q?:string;from?:string;to?:string;payment?:string;status?:string;sort?:string;page?:string};
export function orderState(order:Pick<OrderIntake,'status'|'payment'|'issues'>&{createdAt?:Date},shipment?:Pick<Shipment,'fulfillmentStatus'|'dispatchedAt'>&{tracking?:string;codSatang?:number},sale?:Pick<SalesOrder,'status'>,now=new Date(),receipt?:{tracking:string;amountSatang:number}):Exclude<keyof typeof orderStates,'ALL'>{
 if(order.status==='RETURNED'||shipment?.fulfillmentStatus==='RETURNED')return 'RETURNED';
 if(['CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status)||shipment?.fulfillmentStatus==='CANCELLED')return 'CANCELLED';
 if(needsTrackingReview(order,shipment?.tracking,now)||needsCodReceiptReview(order,shipment,receipt,now)||order.status==='NEEDS_REVIEW'||order.status==='COD_AMOUNT_MISMATCH'||sale?.status==='WAITING_COST'||Array.isArray(order.issues)&&order.issues.length>0)return 'REVIEW';
 if(order.payment==='COD'&&(sale?.status==='WAITING_COD'||order.status==='MATCHED_SHIPMENT_WAITING_COD'))return 'COD';
 return shipment?.fulfillmentStatus==='DISPATCHED'&&shipment.dispatchedAt?'SHIPPED':'WAITING';
}
export function orderRoundRange(input:{from?:string;to?:string;page?:string}={},now=new Date()){
 const thaiDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const current=now.getTime()<dayStart(thaiDay).getTime()+12*3600000?shiftDay(thaiDay,-1):thaiDay;
 const offset=Math.max(0,Math.min(99999,(Math.trunc(Number(input.page))||1)-1));
 const from=shiftDay(current,-offset),to=from;
 if(from>to)throw Error('INVALID_DATE_RANGE');
 return {from,to,start:new Date(+dayStart(from)+12*3600000),end:new Date(+dayStart(shiftDay(to,1))+12*3600000)};
}
export async function orderManagement(input:OrderFilters={}){
 const q=(input.q??'').trim().slice(0,100),from=input.from??'',to=input.to??'',status=Object.hasOwn(orderStates,input.status??'')?input.status as keyof typeof orderStates:'ALL',payment=['โอน','COD','เคลม'].includes(input.payment??'')?input.payment!:'',sort=input.sort==='oldest'?'oldest':'newest',page=Math.max(1,Math.min(100000,Math.trunc(Number(input.page))||1));
 if(from)dayStart(from);if(to)dayStart(to);if(from&&to&&from>to)throw Error('INVALID_DATE_RANGE');
 const trackingIds=q?(await db.shipment.findMany({where:{tracking:{contains:q,mode:'insensitive'}},select:{orderId:true}})).flatMap(s=>s.orderId?[s.orderId]:[]):[];
 const where:Prisma.OrderIntakeWhereInput={...(payment?{payment}:{}),...((from||to)?{eventAt:{...(from?{gte:dayStart(from)}:{}),...(to?{lt:dayStart(shiftDay(to,1))}:{})}}:{}),...(q?{OR:[...['orderNumber','recipient','phone','sellerCode','sellerUsername','customerCode'].map(field=>({[field]:{contains:q,mode:'insensitive'}})),{customerCode:{contains:canonicalCustomerCode(q),mode:'insensitive'}},{id:{in:trackingIds}}]}:{})};
 const earliest=await db.orderIntake.findFirst({orderBy:{eventAt:'asc'},select:{eventAt:true}});
 const latestRound=orderRoundRange();
 const firstRound=earliest?orderRoundRange({},earliest.eventAt):latestRound;
 const roundPages=Math.max(1,Math.round((+latestRound.start-+firstRound.start)/86400000)+1);
 const roundPage=Math.min(page,roundPages);
 const round=orderRoundRange({page:String(roundPage)});
 where.eventAt={gte:round.start,lt:round.end};
 const orders=await db.orderIntake.findMany({where,orderBy:[{eventAt:sort==='oldest'?'asc':'desc'},{id:'asc'}]});
 const ids=orders.map(o=>o.id),[shipments,sales]=await Promise.all([db.shipment.findMany({where:{orderId:{in:ids}}}),db.salesOrder.findMany({where:{orderId:{in:ids}}})]);
 const shipping=new Map(shipments.map(s=>[s.orderId,s])),saleMap=new Map(sales.map(s=>[s.orderId,s]));
 const receipts=await db.codReceipt.findMany({where:{tracking:{in:shipments.map(s=>s.tracking)}}}),receiptMap=new Map(receipts.map(r=>[r.tracking,r])),now=new Date();
 const all=orders.map(order=>{const shipment=shipping.get(order.id),sale=saleMap.get(order.id),receipt=shipment?receiptMap.get(shipment.tracking):undefined;return {order,shipment,sale,receipt,state:orderState(order,shipment,sale,now,receipt),amountSatang:quotedTotal(order.rawText??'')??sale?.revenueSatang??null};});
 const counts=Object.fromEntries(Object.keys(orderStates).map(key=>[key,key==='ALL'?all.length:all.filter(r=>r.state===key).length])) as Record<keyof typeof orderStates,number>;
 const filtered=all.filter(r=>status==='ALL'||r.state===status);
 return {filters:{q,from:'',to:'',status,payment,sort,page:String(roundPage)},round,counts,all:filtered,rows:filtered,count:filtered.length,page:roundPage,pages:roundPages};
}
export function orderListCsv(data:Awaited<ReturnType<typeof orderManagement>>){
 const rows=[['เลขออเดอร์','วันที่รับ','ลูกค้า','เบอร์โทร','ผู้ขาย','การชำระ','ยอดตามออเดอร์ (บาท)','สถานะ','เลขพัสดุ'],...data.all.map(({order:o,shipment:s,state,amountSatang})=>[o.orderNumber,o.eventAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}),o.recipient??'',o.phone??'',o.sellerUsername??o.sellerCode??'',o.payment??'',amountSatang===null?'':(amountSatang/100).toFixed(2),orderStates[state],s?.tracking??''])];
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
