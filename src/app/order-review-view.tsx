import Link from "next/link";
import {OrderCard} from "./order-card";
import type {orderReview} from "@/lib/order-review";
type Data=NonNullable<Awaited<ReturnType<typeof orderReview>>>;
const money=(n:number)=>"฿"+(n/100).toFixed(2);
export function OrderReviewView({data,backHref}:{data:Data;backHref:string}){
 const {order,sale,shipment,receipt,reasons,candidates,canSeeCandidates}=data;
 return <><h1>ตรวจสอบออเดอร์</h1><Link className="button secondary" href={backHref}>กลับรายการออเดอร์</Link>
 <section className="card" style={{marginTop:16}}><h2>สิ่งที่ต้องตรวจสอบ</h2>{reasons.length?<ul>{reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>:<p>ไม่พบเงื่อนไขค้างตรวจจากข้อมูลปัจจุบัน</p>}<p>การเปิดหน้านี้ไม่เปลี่ยนการผูกพัสดุหรือเพิ่มค่าคอม</p></section>
 <OrderCard order={order} sale={sale??undefined} tracking={shipment?.tracking}/>
 {shipment&&<section className="card"><h2>พัสดุที่ผูกไว้</h2><p>เลขพัสดุ: {shipment.tracking}</p><p>ยอดเก็บปลายทางในรายงานส่ง: {money(shipment.codSatang)}</p><p>รายงานรับเงิน COD: {receipt?money(receipt.amountSatang):"ยังไม่พบ"}</p></section>}
 {canSeeCandidates&&!shipment&&<section className="card"><h2>พัสดุที่อาจเกี่ยวข้อง</h2>{!candidates.length?<p>ยังไม่พบพัสดุที่เกี่ยวข้องในรายงานที่นำเข้าไว้ ตรวจข้อมูลในข้อความหรือรอรายงานเพิ่ม</p>:<div className="table-wrap"><table><thead><tr><th>เลขพัสดุ / วันรายงาน</th><th>ผู้รับ / ที่อยู่</th><th>ยอด COD</th><th>รายงานรับเงิน</th><th>การผูก</th></tr></thead><tbody>{candidates.map(s=><tr key={s.tracking}><td>{s.tracking}<br/>{s.reportAt.toLocaleDateString("th-TH",{timeZone:"Asia/Bangkok"})}</td><td style={{whiteSpace:"normal",minWidth:220}}>{s.recipient}<details><summary>ดูที่อยู่</summary>{s.address}</details></td><td>{money(s.codSatang)}</td><td>{s.receipt?money(s.receipt.amountSatang):"ยังไม่พบ"}</td><td>{s.status==="RETURNED"?"ตีกลับ":s.status==="CANCELLED"?"ยกเลิก":s.orderId?"ผูกกับออเดอร์อื่นแล้ว":"ยังไม่ผูก"}</td></tr>)}</tbody></table></div>}</section>}
 </>;
}
