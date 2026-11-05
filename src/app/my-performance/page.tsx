import Link from "next/link";
import {requireAdminPage} from "@/lib/auth";
import {commissionReport} from "@/lib/commission-report";


import {CommissionMonthSelect} from "@/app/commission-month-select";
import {report} from "@/lib/report";
import {employeeOrders} from "@/lib/employee-orders";
import {OrderCard} from "@/app/order-card";
export default async function MyPerformance({searchParams}: {searchParams: Promise<{month?: string}>}){
 const a=await requireAdminPage(["employee"]);
 const [r]=a.affiliateId?await report("all",a.affiliateId):[];
 const requestedMonth=(await searchParams).month;
 const result=r?await commissionReport(requestedMonth,r.id):null;
 const month=result?.month??"",months=result?.months??[],entries=result?.groups.get(r?.id??"")??[];
 const {orders,sales,shipments}=r?await employeeOrders(a.affiliateId,a.username,month):{orders:[],sales:[],shipments:[]};
 const saleByOrder=new Map(sales.map(s=>[s.orderId,s]));
 const trackingByOrder=new Map(shipments.map(s=>[s.orderId,s.tracking]));
 const amount = (status: "Approved" | "Paid") => entries.reduce((sum, row) => sum + (row.status === status ? row.amountSatang : 0), 0) / 100;
 return <main className="center-page"><section className="customer"><h1>ผลงานของฉัน</h1>
 {r?<><p>{r.name} · {r.code}</p><dl>

 <dt>เพื่อนใหม่</dt><dd>{r.approved}</dd>
 </dl><CommissionMonthSelect action="/my-performance" month={month} months={months}/><dl>
 <dt>รอจ่าย</dt><dd>฿{amount("Approved").toFixed(2)}</dd>
 <dt>จ่ายแล้ว</dt><dd>฿{amount("Paid").toFixed(2)}</dd></dl></>:<p>ยังไม่ได้ผูกบัญชีกับ Affiliate</p>}
 {r&&<section style={{marginTop:24}}><h2>ออเดอร์จาก LINE ของฉัน</h2><p>รายการล่าสุดไม่เกิน 100 รายการในเดือนที่เลือก</p>{!orders.length&&<p>ยังไม่มีออเดอร์ของคุณในเดือนนี้</p>}{orders.map(o=><OrderCard key={o.id} order={o} sale={saleByOrder.get(o.id)} sellerName={a.username} tracking={trackingByOrder.get(o.id)} reviewHref={"/my-performance/orders/"+encodeURIComponent(o.id)}/>)}</section>}
 <Link href="/account/password">เปลี่ยนรหัสผ่าน</Link><form action="/api/admin/logout" method="post"><button>ออกจากระบบ</button></form>
 </section></main>;
}
