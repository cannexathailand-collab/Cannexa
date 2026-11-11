import {OrderDocumentButtons} from '@/app/order-document-buttons';
import {OrderShippingDetails} from './order-shipping-details';
import {orderStockItems} from '@/lib/order-stock-items';
import {PopupDetails} from '@/app/popup-details';
import Link from 'next/link';
import {displayCustomerCode} from '@/lib/customer-code';
import type {CSSProperties} from 'react';
import {needsOrderReview} from '@/lib/order-review-state';
import {orderShipmentStatus} from '@/lib/order-shipment-status';
import {quotedTotal} from '@/lib/shipment-matching';
import type {OrderIntake,SalesOrder} from '@prisma/client';
type Props={order:OrderIntake;sale?:Pick<SalesOrder,'commissionSatang'|'status'|'paymentMethod'>;sellerName?:string;groupName?:string;tracking?:string;fulfillmentStatus?:string;dispatchedAt?:Date|null;reviewHref?:string;verificationLabel?:string};
function financialStatus(o:OrderIntake,sale:Props['sale']){
 if(o.status==='RETURNED')return 'ตีกลับ · ไม่นับยอดขาย · รอต้นทุนจากสต็อก';
 if(o.status==='CANCELLED')return 'ยกเลิกแล้ว ไม่นับยอดขายและค่าคอม';
 if(o.status==='WITHDRAWN')return 'ผู้ส่งยกเลิกข้อความ';
 if(o.status==='COD_AMOUNT_MISMATCH')return 'ผูกรายการจัดส่งแล้ว · ยอดรับเงิน COD ไม่ตรง ต้องตรวจสอบ';
 if(o.status==='MATCHED_SHIPMENT_WAITING_COD')return 'ผูกรายการจัดส่งแล้ว · รอจับคู่ COD';
 if(o.status==='CLAIM_WAITING_COST')return 'เคลม · รอต้นทุนจากสต็อก';
 if(sale?.status==='PAID')return o.payment==='COD'?'จ่ายค่าคอมแล้ว · จับคู่ COD สำเร็จ':'จ่ายค่าคอมแล้ว';
 if(sale?.status==='PENDING'&&sale.commissionSatang!==null)return o.payment==='COD'?'บันทึกค่าคอมแล้ว รอจ่าย · จับคู่ COD สำเร็จ':'บันทึกค่าคอมแล้ว รอจ่าย';
 if(o.status==='TRANSFER_RECORDED')return 'บันทึกยอดโอนแล้ว';
 if(o.status==='MATCHED_SHIPMENT')return 'ผูกรายการจัดส่งแล้ว';
 if(o.status==='EXPIRED')return 'หมดระยะเก็บข้อความ';
 if(o.status==='NEEDS_REVIEW')return 'ต้องตรวจข้อมูล · ยังไม่นับยอด';
 return o.payment==='COD'?'รอจับคู่ COD':'รอจับคู่การจัดส่ง · ยังไม่นับยอด';
}
export function OrderCard({order:o,sale,sellerName,groupName,tracking,fulfillmentStatus,dispatchedAt,reviewHref,verificationLabel}:Props){
 const closed=['RETURNED','WITHDRAWN','CANCELLED'].includes(o.status);
 const total=quotedTotal(o.rawText??'');
 const match=orderShipmentStatus(o.status,tracking,fulfillmentStatus,dispatchedAt);
 const color:CSSProperties=o.status==='RETURNED'?{background:'#fff1f2',color:'#991b1b',borderLeft:'4px solid #dc2626'}:closed?(o.payment==='โอน'||sale?.paymentMethod==='TRANSFER'?{background:'#fef9c3',color:'#854d0e',borderLeft:'4px solid #facc15'}:{background:'#fff1f2',color:'#991b1b',borderLeft:'4px solid #dc2626'}):sale?.status==='PAID'?{background:'#166534',color:'#ffffff',borderLeft:'4px solid #14532d'}:o.payment==='COD'&&['WAITING_SHIPMENT','MATCHED_SHIPMENT_WAITING_COD','COD_AMOUNT_MISMATCH'].includes(o.status)?{background:'#fef9c3',color:'#854d0e',borderLeft:'4px solid #facc15'}:sale?.status==='PENDING'&&sale.commissionSatang!==null?{background:'#ecfdf5',color:'#065f46',borderLeft:'4px solid #34d399'}:{};
 return <article style={{borderBottom:'1px solid #ddd',padding:'16px 12px',...color}}>
  <strong>{o.orderNumber}</strong>
  <p className="small">บันทึกเมื่อ {o.createdAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
  <p role="status"><strong>สถานะจัดส่ง: {match.label}</strong></p>
  {verificationLabel&&<p>{verificationLabel}</p>}
  {!!o.customerCode&&<p>รหัสลูกค้า: {displayCustomerCode(o.customerCode)}</p>}
  <p>รับออเดอร์ {o.eventAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'})}</p>
  <p>สถานะออเดอร์ / ค่าคอม: {financialStatus(o,sale)}</p>
  {o.status!=='WITHDRAWN'&&<>
   <OrderShippingDetails orderId={o.id} documentActions={<OrderDocumentButtons orderId={o.id}/>} teamName={groupName} copyDetails={{orderNumber:o.orderNumber,seller:sellerName??o.sellerUsername??o.sellerCode,createdAt:o.createdAt,status:match.label,extraLines:['สถานะออเดอร์ / ค่าคอม '+financialStatus(o,sale)]}} data={{recipient:o.recipient,phone:o.phone,address:o.address,payment:o.payment,amountSatang:total,items:orderStockItems(o.rawText).items}} tracking={tracking}>{reviewHref&&(needsOrderReview(o,sale,tracking)||!!tracking&&!dispatchedAt&&!closed)&&<Link className="button secondary" href={reviewHref}>ตรวจสอบ</Link>}</OrderShippingDetails>
   {Array.isArray(o.issues)&&o.issues.length>0&&<p className="muted">{o.issues.map(String).join(' · ')}</p>}
   {o.payment==='โอน'&&!(fulfillmentStatus==='DISPATCHED'&&dispatchedAt)&&<p>ยอดขายรอยืนยันจากรายงานจัดส่ง</p>}
   {o.status==='RETURNED'&&<p>ต้นทุนพัสดุตีกลับ: รอข้อมูลจากระบบสต็อก</p>}
   {o.payment==='เคลม'&&<p>ไม่เพิ่มยอดขายหรือค่าคอม · ต้นทุนสินค้า: รอข้อมูลจากสต็อก ไม่รวมค่าส่ง</p>}
   {!!sale&&<p>ค่าคอมยอดขาย: {sale.status==='CANCELLED'?'ยกเลิกแล้ว ฿0.00':sale.status==='PAID'?'฿'+((sale.commissionSatang??0)/100).toFixed(2)+' จ่ายแล้ว':sale.status==='WAITING_COD'?'รอรับเงิน COD · ยังไม่บันทึกค่าคอม':sale.commissionSatang===null?'รอต้นทุน':'฿'+(sale.commissionSatang/100).toFixed(2)+' รอจ่าย'}</p>}
   <p className="small muted">ตอบยืนยัน: {o.replyStatus==='SENT'?'ส่งแล้ว':o.replyStatus==='FAILED'?'ส่งไม่สำเร็จ':o.replyStatus==='NOT_CONFIGURED'?'ยังไม่มี Access Token':'ยังไม่ส่ง'}</p>
   <PopupDetails summary={<> ดูข้อความต้นฉบับ </>}><p className="muted">รหัสผู้ขายที่ส่งมา: {o.sellerCode} (เก็บตามข้อความเดิม)</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{o.rawText}</pre></PopupDetails>
  </>}
 {o.status==='WITHDRAWN'&&<OrderDocumentButtons orderId={o.id}/>}</article>;
}
