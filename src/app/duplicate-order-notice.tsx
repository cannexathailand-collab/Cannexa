import {PopupDetails} from './popup-details';
import Link from 'next/link';
import type {DuplicateOrderMatch} from '@/lib/order-duplicates';
type OrderTime={orderNumber:string;eventAt:Date;createdAt?:Date};
const formatTime=(date:Date)=>date.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function DuplicateOrderNotice({matches,currentOrder,employee=false,baseHref}:{matches:DuplicateOrderMatch[];currentOrder:OrderTime;employee?:boolean;baseHref?:string}){
 if(!matches.length)return null;
 return <div className="duplicate-order-notice" role="alert">
  <strong>ต้องตรวจสอบ · เข้าข่ายออเดอร์ซ้ำ</strong>
  <p>รายการนี้สร้างเมื่อ <time dateTime={(currentOrder.createdAt??currentOrder.eventAt).toISOString()}>{formatTime(currentOrder.createdAt??currentOrder.eventAt)}</time> น.</p>
  <p>{[...new Set(matches.flatMap(match=>match.reasons))].join(' · ')}</p>
  <PopupDetails summary={"ดูออเดอร์ที่เข้าข่ายซ้ำ ("+matches.length+")"} title="ตรวจสอบออเดอร์ที่อาจซ้ำ">
   <p><strong>รายการนี้ · {currentOrder.orderNumber}</strong><br/>สร้างออเดอร์ <time dateTime={currentOrder.eventAt.toISOString()}>{formatTime(currentOrder.eventAt)}</time> น.</p>
   <ul>{matches.map(match=><li key={match.id}>
    <Link href={(baseHref??(employee?'/my-performance/orders/':'/admin/orders/list/'))+encodeURIComponent(match.id)}>{match.orderNumber} · {match.recipient}</Link>
    <p>รับออเดอร์ <time dateTime={(match.createdAt??match.eventAt).toISOString()}>{formatTime(match.createdAt??match.eventAt)}</time> น.</p>
   </li>)}</ul>
   <small>เวลาไทย · เทียบคำสั่งซื้อและหลักฐานการชำระก่อนยกเลิกรายการที่เกิน</small>
  </PopupDetails>
 </div>;
}
