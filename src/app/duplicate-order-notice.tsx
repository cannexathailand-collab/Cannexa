import {PopupDetails} from './popup-details';
import Link from 'next/link';
import type {DuplicateOrderMatch} from '@/lib/order-duplicates';
export function DuplicateOrderNotice({matches,employee=false}:{matches:DuplicateOrderMatch[];employee?:boolean}){
 if(!matches.length)return null;
 return <div className="duplicate-order-notice" role="alert"><strong>ต้องตรวจสอบ · เข้าข่ายออเดอร์ซ้ำ</strong><p>{[...new Set(matches.flatMap(match=>match.reasons))].join(' · ')}</p><PopupDetails summary={"ดูออเดอร์ที่เข้าข่ายซ้ำ ("+matches.length+")"} title="ตรวจสอบออเดอร์ที่อาจซ้ำ"><ul>{matches.map(match=><li key={match.id}><Link href={(employee?'/my-performance/orders/':'/admin/orders/list/')+encodeURIComponent(match.id)}>{match.orderNumber} · {match.recipient} · {match.eventAt.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</Link></li>)}</ul><small>เทียบคำสั่งซื้อและหลักฐานการชำระก่อนยกเลิกรายการที่เกิน</small></PopupDetails></div>;
}
