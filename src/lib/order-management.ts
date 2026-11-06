import type {OrderIntake,Shipment,SalesOrder,Prisma} from '@prisma/client';
import {db} from './db';
import {dayStart,shiftDay} from './sales-dates';
import {csvCell} from './policy';
import {quotedTotal} from './shipment-matching';
import {canonicalCustomerCode} from './customer-code';
export const orderStates={ALL:'ทั้งหมด',REVIEW:'ต้องตรวจสอบ',WAITING:'รอจัดส่ง',COD:'รอรับเงิน COD',SHIPPED:'จัดส่งแล้ว',RETURNED:'ตีกลับ',CANCELLED:'ยกเลิก / ปิดรายการ'} as const;
export type OrderFilters={q?:string;from?:string;to?:string;payment?:string;status?:string;sort?:string;page?:string};
export function orderState(order:Pick<OrderIntake,'status'|'payment'|'issues'>,shipment?:Pick<Shipment,'fulfillmentStatus'|'dispatchedAt'>,sale?:Pick<SalesOrder,'status'>):Exclude<keyof typeof orderStates,'ALL'>{
 if(order.status==='RETURNED'||shipment?.fulfillmentStatus==='RETURNED')return 'RETURNED';
 if(['CANCELLED','WITHDRAWN','EXPIRED'].includes(order.status)||shipment?.fulfillmentStatus==='CANCELLED')return 'CANCELLED';
 if(order.status==='NEEDS_REVIEW'||order.status==='COD_AMOUNT_MISMATCH'||sale?.status==='WAITING_COST'||Array.isArray(order.issues)&&order.issues.length>0)return 'REVIEW';
 if(order.payment==='COD'&&(sale?.status==='WAITING_COD'||order.status==='MATCHED_SHIPMENT_WAITING_COD'))return 'COD';
 return shipment?.fulfillmentStatus==='DISPATCHED'&&shipment.dispatchedAt?'SHIPPED':'WAITING';
}
export async function orderManagement(input:OrderFilters={}){
 const q=(input.q??'').trim().slice(0,100),from=input.from??'',to=input.to??'',status=Object.hasOwn(orderStates,input.status??'')?input.status as keyof typeof orderStates:'ALL',payment=['โอน','COD','เคลม'].includes(input.payment??'')?input.payment!:'',sort=input.sort==='oldest'?'oldest':'newest',page=Math.max(1,Math.min(100000,Math.trunc(Number(input.page))||1));
 if(from)dayStart(from);if(to)dayStart(to);if(from&&to&&from>to)throw Error('INVALID_DATE_RANGE');
 const trackingIds=q?(await db.shipment.findMany({where:{tracking:{contains:q,mode:'insensitive'}},select:{orderId:true}})).flatMap(s=>s.orderId?[s.orderId]:[]):[];
 const where:Prisma.OrderIntakeWhereInput={...(payment?{payment}:{}),...((from||to)?{eventAt:{...(from?{gte:dayStart(from)}:{}),...(to?{lt:dayStart(shiftDay(to,1))}:{})}}:{}),...(q?{OR:[...['orderNumber','recipient','phone','sellerCode','sellerUsername','customerCode'].map(field=>({[field]:{contains:q,mode:'insensitive'}})),{customerCode:{contains:canonicalCustomerCode(q),mode:'insensitive'}},{id:{in:trackingIds}}]}:{})};
 const orders=await db.orderIntake.findMany({where,orderBy:[{eventAt:sort==='oldest'?'asc':'desc'},{id:'asc'}]});
 const ids=orders.map(o=>o.id),[shipments,sales]=await Promise.all([db.shipment.findMany({where:{orderId:{in:ids}}}),db.salesOrder.findMany({where:{orderId:{in:ids}}})]);
 const shipping=new Map(shipments.map(s=>[s.orderId,s])),saleMap=new Map(sales.map(s=>[s.orderId,s]));
 const all=orders.map(order=>{const shipment=shipping.get(order.id),sale=saleMap.get(order.id);return {order,shipment,sale,state:orderState(order,shipment,sale),amountSatang:quotedTotal(order.rawText??'')??sale?.revenueSatang??null};});
 const counts=Object.fromEntries(Object.keys(orderStates).map(key=>[key,key==='ALL'?all.length:all.filter(r=>r.state===key).length])) as Record<keyof typeof orderStates,number>;
 const filtered=all.filter(r=>status==='ALL'||r.state===status),pages=Math.max(1,Math.ceil(filtered.length/50)),current=Math.min(page,pages);
 return {filters:{q,from,to,status,payment,sort},counts,all:filtered,rows:filtered.slice((current-1)*50,current*50),count:filtered.length,page:current,pages};
}
export function orderListCsv(data:Awaited<ReturnType<typeof orderManagement>>){
 const rows=[['เลขออเดอร์','วันที่รับ','ลูกค้า','เบอร์โทร','ผู้ขาย','การชำระ','ยอดตามออเดอร์ (บาท)','สถานะ','เลขพัสดุ'],...data.all.map(({order:o,shipment:s,state,amountSatang})=>[o.orderNumber,o.eventAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}),o.recipient??'',o.phone??'',o.sellerUsername??o.sellerCode??'',o.payment??'',amountSatang===null?'':(amountSatang/100).toFixed(2),orderStates[state],s?.tracking??''])];
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
