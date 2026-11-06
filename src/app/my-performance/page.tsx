import Link from "next/link";
import {requireAdminPage} from "@/lib/auth";
import {commissionReport} from "@/lib/commission-report";


import {CommissionMonthSelect} from "@/app/commission-month-select";
import {report} from "@/lib/report";
import {employeeOrders} from "@/lib/employee-orders";
import {OrderCard} from "@/app/order-card";
import {salesReport} from '@/lib/sales-report';
import {pendingCommissionThisRound,noonCommissionWindow} from '@/lib/noon-commission';
import {CommissionPanel} from './commission-panel';
export default async function MyPerformance({searchParams}: {searchParams: Promise<{month?: string;kind?:string;status?:string;commissionMonth?:string;commissionPage?:string;reviewPage?:string}>}){
 const a=await requireAdminPage(["employee"]);
 const [r]=a.affiliateId?await report("all",a.affiliateId):[];
 const filters=await searchParams,requestedMonth=filters.month;
 const result=r?await commissionReport(requestedMonth,r.id):null;
 const month=result?.month??"",months=result?.months??[],entries=result?.groups.get(r?.id??"")??[];
 const {orders,sales,shipments}=r?await employeeOrders(a.affiliateId,a.username,month):{orders:[],sales:[],shipments:[]};
 const [closed,referred]=r?await Promise.all([salesReport({month,seller:a.username}),salesReport({month,affiliateId:a.affiliateId!})]):[null,null];
 const money=(n:number)=>(n/100).toLocaleString('th-TH',{style:'currency',currency:'THB'});
 const now=new Date(),round=noonCommissionWindow(now),roundAmount=r?await pendingCommissionThisRound(r.id,now):null;
 const roundDate=(date:Date)=>date.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 const saleByOrder=new Map(sales.map(s=>[s.orderId,s]));
 const trackingByOrder=new Map(shipments.map(s=>[s.orderId,s.tracking]));
 const amount = (status: "Approved" | "Paid") => entries.reduce((sum, row) => sum + (row.status === status ? row.amountSatang : 0), 0) / 100;
 return <main className="center-page performance-page"><section className="customer"><h1>ผลงานของฉัน</h1>
 {r?<><p>{r.name} · {r.code}</p><section className="employee-noon-commission" aria-label="ค่าคอมรอรับสะสมรอบปัจจุบัน"><span>ค่าคอมรอรับสะสม</span><strong>{money(roundAmount??0)}</strong><small>รอบ {roundDate(round.start)} – {roundDate(round.end)}</small><p>เริ่มรอบแสดงผลใหม่ทุกเที่ยง เฉพาะค่าคอมที่คำนวณแล้วและยังไม่จ่ายในรอบนี้</p></section><dl>

 <dt>เพื่อนใหม่</dt><dd>{r.approved}</dd>
 </dl><CommissionPanel affiliateId={r.id} username={a.username} filters={filters}/><section className="commission-monthly"><h2>สรุปผลงานรายเดือน</h2><CommissionMonthSelect action="/my-performance" month={month} months={months}/><dl>
 <dt>ค่าคอมรอจ่ายของเดือนที่เลือก</dt><dd>฿{amount("Approved").toFixed(2)}</dd>
 <dt>ค่าคอมจ่ายแล้วของเดือนที่เลือก</dt><dd>฿{amount("Paid").toFixed(2)}</dd></dl></section></>:<p>ยังไม่ได้ผูกบัญชีกับ Affiliate</p>}
 {closed&&referred&&<section><h2>ยอดขายและผลงานของฉัน</h2><dl><dt>ยอดขายที่ฉันปิดการขาย</dt><dd>{money(closed.summary.revenueSatang)} · {closed.summary.count} ออเดอร์</dd><dt>ยอดขายจากลูกค้าที่ฉันแนะนำ</dt><dd>{money(referred.summary.revenueSatang)} · {referred.summary.count} ออเดอร์</dd><dt>ลูกค้าที่แนะนำและซื้อในเดือนนี้</dt><dd>{new Set(referred.summary.rows.flatMap(s=>s.customer?[s.customer.code]:[])).size} คน</dd></dl><p className="small muted">เฉพาะยอดขายที่ยืนยันแล้วของเดือนที่เลือก ยอดสองมุมอาจเป็นออเดอร์เดียวกัน จึงไม่ใช้บวกเป็นยอดรวมร้าน</p></section>}
 {r&&<section style={{marginTop:24}}><h2>ออเดอร์จาก LINE ของฉัน</h2><p>รายการล่าสุดไม่เกิน 100 รายการในเดือนที่เลือก</p>{!orders.length&&<p>ยังไม่มีออเดอร์ของคุณในเดือนนี้</p>}{orders.map(o=><OrderCard key={o.id} order={o} sale={saleByOrder.get(o.id)} sellerName={a.username} tracking={trackingByOrder.get(o.id)} fulfillmentStatus={shipments.find(s=>s.orderId===o.id)?.fulfillmentStatus} dispatchedAt={shipments.find(s=>s.orderId===o.id)?.dispatchedAt} reviewHref={"/my-performance/orders/"+encodeURIComponent(o.id)}/>)}</section>}
 <Link href="/account/password">เปลี่ยนรหัสผ่าน</Link><form action="/api/admin/logout" method="post"><button>ออกจากระบบ</button></form>
 </section></main>;
}
